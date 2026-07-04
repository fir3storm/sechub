-- PostgreSQL full-text search for NewsArticle
ALTER TABLE sechub."NewsArticle"
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION sechub.news_article_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.body, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW."cveIds", ' '), '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."sourceName", '')), 'D') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW."affectedDevices", ' '), '')), 'D') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW."affectedOs", ' '), '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS news_article_search_vector_trigger ON sechub."NewsArticle";

CREATE TRIGGER news_article_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, summary, body, "cveIds", "sourceName", "affectedDevices", "affectedOs"
  ON sechub."NewsArticle"
  FOR EACH ROW
  EXECUTE FUNCTION sechub.news_article_search_vector_update();

UPDATE sechub."NewsArticle"
SET title = title
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS news_article_search_vector_idx
  ON sechub."NewsArticle"
  USING GIN (search_vector);
