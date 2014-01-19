SELECT a.b, 
	(SELECT c.d FROM c) e 
FROM a
