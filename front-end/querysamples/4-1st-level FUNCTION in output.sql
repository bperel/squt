SELECT co.ContractID AS ID, CONCAT(p.firstName, p.lastName) AS PersonFullName
FROM ContractID co
INNER JOIN Person p ON co.personInChargeID = p.ID
WHERE co.isActive = 1;