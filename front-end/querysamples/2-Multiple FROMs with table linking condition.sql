SELECT co.contractID AS ID, co.contractOrigin, comp.companyName
FROM Contract co, Company comp
WHERE co.contractType='C' AND co.contractID > 0
AND co.companyCode = comp.companyCode
ORDER BY co.contractDate;