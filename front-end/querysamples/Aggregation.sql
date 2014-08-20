SELECT books.name as book_name, COUNT(DISTINCT chapters.name) AS nb_chapters
FROM books
INNER JOIN chapters ON books.id = chapters.book_id
GROUP BY books.name