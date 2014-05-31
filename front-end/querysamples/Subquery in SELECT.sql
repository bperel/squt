SELECT a.b, 
	(SELECT c.d FROM c LIMIT 2, 4) e
FROM a
