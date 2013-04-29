SELECT co.ContractID AS ID, CONCAT(SUBSTRING(p.firstName,0,1),'.', p.lastName) AS PersonDisplayedName, IF(p.lastName="Doe", "Classic", "Unusual") AS IsClassicLastName
FROM Contract co
INNER JOIN Person p ON co.personInChargeID = p.ID
WHERE co.isActive = 1;