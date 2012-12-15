SELECT comp.companyName, co.contractID AS ID 
FROM Contrat co 
INNER JOIN Company comp ON co.companyCode = comp.companyCode;