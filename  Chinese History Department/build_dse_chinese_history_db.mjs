import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, unlinkSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)));
const seedPath = resolve(dataDir, 'dse_chinese_history_seed.json');
const dbPath = resolve(dataDir, 'dse_chinese_history.sqlite');
const schemaPath = resolve(dataDir, 'dse_chinese_history_schema.sql');
const seed = JSON.parse(await import('node:fs/promises').then(fs => fs.readFile(seedPath, 'utf8')));
const distDir = resolve(dataDir, '../dist');
mkdirSync(dataDir, { recursive: true });
if (existsSync(dbPath)) unlinkSync(dbPath);

const schema = [
  'PRAGMA foreign_keys = ON;',
  'PRAGMA encoding = "UTF-8";',
  'CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);',
  'CREATE TABLE course_versions (id TEXT PRIMARY KEY, name TEXT NOT NULL, valid_from INTEGER, valid_to INTEGER, status TEXT NOT NULL, notes TEXT);',
  'CREATE TABLE sources (source_id TEXT PRIMARY KEY, publisher TEXT NOT NULL, title TEXT NOT NULL, source_type TEXT NOT NULL, authority_tier TEXT NOT NULL, original_url TEXT, accessed_at TEXT NOT NULL, version_label TEXT, license_status TEXT, review_status TEXT NOT NULL, notes TEXT);',
  'CREATE TABLE units (unit_id TEXT PRIMARY KEY, course_version_id TEXT NOT NULL, part TEXT NOT NULL, unit_no INTEGER NOT NULL, name TEXT NOT NULL, period TEXT, mandatory INTEGER NOT NULL, FOREIGN KEY(course_version_id) REFERENCES course_versions(id));',
  'CREATE TABLE topics (topic_id TEXT PRIMARY KEY, unit_id TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL, mandatory INTEGER NOT NULL, content_status TEXT NOT NULL, FOREIGN KEY(unit_id) REFERENCES units(unit_id));',
  'CREATE TABLE narrative_sections (section_id INTEGER PRIMARY KEY AUTOINCREMENT, topic_id TEXT NOT NULL, sequence_no INTEGER NOT NULL, title TEXT NOT NULL, section_type TEXT NOT NULL, text TEXT NOT NULL, char_count INTEGER NOT NULL, content_hash TEXT NOT NULL, review_status TEXT NOT NULL, FOREIGN KEY(topic_id) REFERENCES topics(topic_id));',
  'CREATE TABLE entities (entity_id INTEGER PRIMARY KEY AUTOINCREMENT, canonical_name TEXT NOT NULL UNIQUE, entity_type TEXT NOT NULL, aliases TEXT, notes TEXT);',
  'CREATE TABLE topic_entities (topic_id TEXT NOT NULL, entity_id INTEGER NOT NULL, PRIMARY KEY(topic_id, entity_id), FOREIGN KEY(topic_id) REFERENCES topics(topic_id), FOREIGN KEY(entity_id) REFERENCES entities(entity_id));',
  'CREATE TABLE events (event_id INTEGER PRIMARY KEY AUTOINCREMENT, topic_id TEXT NOT NULL, name TEXT NOT NULL, start_year INTEGER, end_year INTEGER, description TEXT NOT NULL, significance TEXT, FOREIGN KEY(topic_id) REFERENCES topics(topic_id));',
  'CREATE TABLE section_sources (section_id INTEGER NOT NULL, source_id TEXT NOT NULL, locator TEXT, evidence_role TEXT NOT NULL, PRIMARY KEY(section_id, source_id), FOREIGN KEY(section_id) REFERENCES narrative_sections(section_id), FOREIGN KEY(source_id) REFERENCES sources(source_id));',
  'CREATE VIEW topic_full_text AS SELECT t.topic_id, u.part, u.unit_no, u.name AS unit_name, t.code, t.name AS topic_name, GROUP_CONCAT(ns.title || char(10) || ns.text, char(10) || char(10)) AS full_text, SUM(ns.char_count) AS char_count FROM topics t JOIN units u ON u.unit_id=t.unit_id JOIN narrative_sections ns ON ns.topic_id=t.topic_id GROUP BY t.topic_id, u.part, u.unit_no, u.name, t.code, t.name;',
  'CREATE INDEX idx_topics_unit ON topics(unit_id);',
  'CREATE INDEX idx_sections_topic ON narrative_sections(topic_id, sequence_no);',
  'CREATE INDEX idx_events_topic ON events(topic_id);',
  'CREATE INDEX idx_entities_name ON entities(canonical_name);'
];
const schemaSql = schema.join('\n');
writeFileSync(schemaPath, '-- Generated schema for dse_chinese_history.sqlite\n' + schemaSql + '\n', 'utf8');

const db = new DatabaseSync(dbPath);
db.exec(schemaSql);
const now = new Date().toISOString();
const insertMeta = db.prepare('INSERT INTO metadata(key,value) VALUES(?,?)');
for (const [key, value] of Object.entries({
  database_name: 'DSE 中國歷史封閉式資料庫',
  schema_version: '1.0.0',
  content_version: 'legacy_2026_2029_seed_v1',
  language: seed.language,
  scope: '香港高中中國歷史中四至中六：八個必修單元及六個選修單元',
  generated_by: 'build_dse_chinese_history_db.mjs',
  content_policy: '完整敘事種子內容；尚待逐段配對學術及一手史料後才可作正式封閉式作答證據',
  created_at: now
})) insertMeta.run(key, value);

db.prepare('INSERT INTO course_versions VALUES(?,?,?,?,?,?)').run(
  seed.course_version, seed.version_label, 2026, 2029, 'active_seed',
  '按上一次回覆所列的中四至中六課程建立；2030年或以後課程不可與本版本無條件混用。'
);

const sources = [
  ['EDB-CH-CURRICULUM', '香港教育局', '中國歷史課程及評估指引（中四至中六）2007（2015年11月更新）', 'curriculum_document', 'A', 'https://www.edb.gov.hk/cd/pshe/curriculum/chi/default.html', '2007/2015-11', 'official_web_page', 'catalogued', '確認課程版本及架構。'],
  ['EDB-CH-CORE', '香港教育局', '高中中國歷史（中四至中六）課程支援教材（必修部分）', 'teaching_resource', 'B', 'https://www.edb.gov.hk/tc/curriculum-development/kla/pshe/references-and-resources/chinese-history/support-materials-core-part.html', 'current_page', 'official_web_page', 'catalogued', '核對必修單元及課題名稱。'],
  ['EDB-CH-ELECTIVE', '香港教育局', '高中中國歷史（中四至中六）課程支援教材（選修部分）', 'teaching_resource', 'B', 'https://www.edb.gov.hk/tc/curriculum-development/kla/pshe/references-and-resources/chinese-history/support-materials-elective-part.html', 'current_page', 'official_web_page', 'catalogued', '核對六個選修單元及學習重點。'],
  ['EDB-NSE-CH-2025', '香港教育局', '個人、社會及人文教育學習領域—中國歷史科（2025）', 'framework_document', 'A', 'https://www.edb.gov.hk/attachment/tc/curriculum-development/4-key-tasks/moral-civic/nse/nse2025_subject_framework_pshechist.pdf', '2025', 'official_web_page', 'catalogued', '確認高中課程涵蓋上古至二十世紀末。'],
  ['LOCAL-NARRATIVE-SEED', '本專案', '人工編寫的歷史敘事種子內容', 'authored_synthesis', 'DRAFT', null, 'seed_v1', 'project_internal', 'needs_source_review', '不是外部原文摘錄；每段需要配對可靠學術或一手史料。']
];
const insertSource = db.prepare('INSERT INTO sources VALUES(?,?,?,?,?,?,?,?,?,?,?)');
for (const s of sources) insertSource.run(s[0], s[1], s[2], s[3], s[4], s[5], now, s[6], s[7], s[8], s[9]);
writeFileSync(resolve(dataDir, 'dse_chinese_history_sources.json'), JSON.stringify(
  sources.map(s => ({ source_id: s[0], publisher: s[1], title: s[2], source_type: s[3], authority_tier: s[4], original_url: s[5], version_label: s[6], license_status: s[7], review_status: s[8], notes: s[9] })),
  null, 2
), 'utf8');

const insertUnit = db.prepare('INSERT INTO units VALUES(?,?,?,?,?,?,?)');
const insertTopic = db.prepare('INSERT INTO topics VALUES(?,?,?,?,?,?)');
const insertSection = db.prepare('INSERT INTO narrative_sections(topic_id,sequence_no,title,section_type,text,char_count,content_hash,review_status) VALUES(?,?,?,?,?,?,?,?)');
const insertSectionSource = db.prepare('INSERT INTO section_sources VALUES(?,?,?,?)');
const insertEvent = db.prepare('INSERT INTO events(topic_id,name,start_year,end_year,description,significance) VALUES(?,?,?,?,?,?)');
const insertEntity = db.prepare('INSERT INTO entities(canonical_name,entity_type,aliases,notes) VALUES(?,?,?,?)');
const insertTopicEntity = db.prepare('INSERT INTO topic_entities(topic_id,entity_id) VALUES(?,?)');
const entityIds = new Map();

const classifyEntity = name => {
  if (/黃河|長江|珠江|洛陽|長安|臨安|廣州|上海|香港|澳門|北京|西藏|新疆|泉州|建康|關中/.test(name)) return 'place';
  if (/制|法|制度|運動|革命|戰爭|之亂|條約|事件|變法|絲路|新政|改革|建設|關係|教|儒|佛|道|史記|論語|新史學|婚姻法|一國兩制/.test(name)) return 'concept_or_institution';
  if (/帝|公|侯|王|后|宗|僧|子|孫|何|梁|胡|李|張|陳|劉|康|董|袁|周|毛|鄧|林|趙|江|宋|朱|曾|左|孔|司馬|孟|韓|墨|老|戚|魏|黎|尼克遜|商鞅|王安石/.test(name)) return 'person';
  return 'other';
};

for (const unit of seed.units) {
  insertUnit.run(unit.id, seed.course_version, unit.part, unit.unit_no, unit.name, unit.period, unit.mandatory ? 1 : 0);
  for (const topic of unit.topics) {
    insertTopic.run(topic.id, unit.id, topic.code, topic.name, topic.mandatory ? 1 : 0, 'narrative_seed_needs_source_review');
    for (let i = 0; i < topic.sections.length; i++) {
      const section = topic.sections[i];
      const hash = createHash('sha256').update(section.text, 'utf8').digest('hex');
      const result = insertSection.run(topic.id, i + 1, section.title, 'full_narrative', section.text, [...section.text].length, hash, 'needs_source_review');
      const sectionId = Number(result.lastInsertRowid);
      insertSectionSource.run(sectionId, topic.mandatory ? 'EDB-CH-CORE' : 'EDB-CH-ELECTIVE', '課程範圍及課題名稱；敘事為人工種子', 'curriculum_scope');
      insertSectionSource.run(sectionId, 'LOCAL-NARRATIVE-SEED', '人工敘事種子 v1', 'draft_narrative');
    }
    for (const event of topic.events ?? []) {
      insertEvent.run(topic.id, event.name, event.start_year, event.end_year, event.description, '需配對史料後再作正式證據');
    }
    for (const name of topic.entities ?? []) {
      if (!entityIds.has(name)) {
        const result = insertEntity.run(name, classifyEntity(name), null, '由課題種子內容登記；待別名、年代和來源補全');
        entityIds.set(name, Number(result.lastInsertRowid));
      }
      insertTopicEntity.run(topic.id, entityIds.get(name));
    }
  }
}
db.exec('ANALYZE;');
db.close();

const readDb = new DatabaseSync(dbPath);
const count = table => Number(readDb.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n);
const manifest = {
  database: 'dse_chinese_history.sqlite',
  course_version: seed.course_version,
  generated_at: new Date().toISOString(),
  tables: Object.fromEntries(['units', 'topics', 'narrative_sections', 'events', 'entities', 'sources'].map(t => [t, count(t)])),
  mandatory_units: seed.units.filter(u => u.mandatory).length,
  elective_units: seed.units.filter(u => !u.mandatory).length,
  content_status: 'needs_source_review',
  note: '已入庫完整敘事種子，但尚未逐段配對學術／一手史料；不可宣稱為已完成封閉式證據庫。'
};
readDb.close();
writeFileSync(resolve(dataDir, 'dse_chinese_history_db_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
writeFileSync(resolve(dataDir, 'dse_chinese_history_legacy_2026_2029_curriculum.json'), JSON.stringify({
  course_version: seed.course_version,
  version_label: seed.version_label,
  language: seed.language,
  units: seed.units.map(({ id, part, unit_no, name, period, mandatory, topics }) => ({
    id, part, unit_no, name, period, mandatory,
    topics: topics.map(({ id, code, name, mandatory, sections }) => ({
      id, code, name, mandatory, narrative_sections: sections.map(s => s.title)
    }))
  }))
}, null, 2), 'utf8');

if (existsSync(distDir)) {
  writeFileSync(resolve(distDir, 'data.json'), JSON.stringify(seed, null, 2) + '\n', 'utf8');
  writeFileSync(resolve(distDir, 'data.js'), 'window.__DSE_DATABASE__ = ' + JSON.stringify(seed) + ';\n', 'utf8');
}

console.log(JSON.stringify(manifest, null, 2));
