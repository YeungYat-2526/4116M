-- Generated schema for dse_chinese_history.sqlite
PRAGMA foreign_keys = ON;
PRAGMA encoding = "UTF-8";
CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE course_versions (id TEXT PRIMARY KEY, name TEXT NOT NULL, valid_from INTEGER, valid_to INTEGER, status TEXT NOT NULL, notes TEXT);
CREATE TABLE sources (source_id TEXT PRIMARY KEY, publisher TEXT NOT NULL, title TEXT NOT NULL, source_type TEXT NOT NULL, authority_tier TEXT NOT NULL, original_url TEXT, accessed_at TEXT NOT NULL, version_label TEXT, license_status TEXT, review_status TEXT NOT NULL, notes TEXT);
CREATE TABLE units (unit_id TEXT PRIMARY KEY, course_version_id TEXT NOT NULL, part TEXT NOT NULL, unit_no INTEGER NOT NULL, name TEXT NOT NULL, period TEXT, mandatory INTEGER NOT NULL, FOREIGN KEY(course_version_id) REFERENCES course_versions(id));
CREATE TABLE topics (topic_id TEXT PRIMARY KEY, unit_id TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL, mandatory INTEGER NOT NULL, content_status TEXT NOT NULL, FOREIGN KEY(unit_id) REFERENCES units(unit_id));
CREATE TABLE narrative_sections (section_id INTEGER PRIMARY KEY AUTOINCREMENT, topic_id TEXT NOT NULL, sequence_no INTEGER NOT NULL, title TEXT NOT NULL, section_type TEXT NOT NULL, text TEXT NOT NULL, char_count INTEGER NOT NULL, content_hash TEXT NOT NULL, review_status TEXT NOT NULL, FOREIGN KEY(topic_id) REFERENCES topics(topic_id));
CREATE TABLE entities (entity_id INTEGER PRIMARY KEY AUTOINCREMENT, canonical_name TEXT NOT NULL UNIQUE, entity_type TEXT NOT NULL, aliases TEXT, notes TEXT);
CREATE TABLE topic_entities (topic_id TEXT NOT NULL, entity_id INTEGER NOT NULL, PRIMARY KEY(topic_id, entity_id), FOREIGN KEY(topic_id) REFERENCES topics(topic_id), FOREIGN KEY(entity_id) REFERENCES entities(entity_id));
CREATE TABLE events (event_id INTEGER PRIMARY KEY AUTOINCREMENT, topic_id TEXT NOT NULL, name TEXT NOT NULL, start_year INTEGER, end_year INTEGER, description TEXT NOT NULL, significance TEXT, FOREIGN KEY(topic_id) REFERENCES topics(topic_id));
CREATE TABLE section_sources (section_id INTEGER NOT NULL, source_id TEXT NOT NULL, locator TEXT, evidence_role TEXT NOT NULL, PRIMARY KEY(section_id, source_id), FOREIGN KEY(section_id) REFERENCES narrative_sections(section_id), FOREIGN KEY(source_id) REFERENCES sources(source_id));
CREATE VIEW topic_full_text AS SELECT t.topic_id, u.part, u.unit_no, u.name AS unit_name, t.code, t.name AS topic_name, GROUP_CONCAT(ns.title || char(10) || ns.text, char(10) || char(10)) AS full_text, SUM(ns.char_count) AS char_count FROM topics t JOIN units u ON u.unit_id=t.unit_id JOIN narrative_sections ns ON ns.topic_id=t.topic_id GROUP BY t.topic_id, u.part, u.unit_no, u.name, t.code, t.name;
CREATE INDEX idx_topics_unit ON topics(unit_id);
CREATE INDEX idx_sections_topic ON narrative_sections(topic_id, sequence_no);
CREATE INDEX idx_events_topic ON events(topic_id);
CREATE INDEX idx_entities_name ON entities(canonical_name);
