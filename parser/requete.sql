SELECT co.numeroContrat AS NUMERO, co.origineContrat, co2.aaa, e.codeEntite
FROM Contrat co, Contrat co2, EtabPost e
WHERE co.typeContrat='C' AND co.numeroContrat > 0 
AND co.codeEntite = e.codeEntite
ORDER BY co.dateContrat;