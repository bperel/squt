SELECT DISTINCT comp.companyName, co.contractID AS ID
FROM Contract co 
INNER JOIN Company comp ON co.companyCode = comp.companyCode;