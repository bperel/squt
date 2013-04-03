SELECT * FROM articles WHERE MATCH (title,body) AGAINST ('database' IN BOOLEAN MODE)
