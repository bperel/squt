SELECT * FROM articles WHERE MATCH (title,body) AGAINST ('database' WITH QUERY EXPANSION)
