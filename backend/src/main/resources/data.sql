
DELETE FROM utilisateurs WHERE email IN (
  'admin@smartassign.tn',
  'manager@smartassign.tn',
  'collab@smartassign.tn'
);

INSERT INTO utilisateurs (nom, email, mot_de_passe, role)
SELECT 'Manager Demo', 'manager@smartassign.tn',
'$2a$10$wI8QwQwQwQwQwQwQwQwQwOQwQwQwQwQwQwQwQwQwQwQwQwQwQwQwQ',
'MANAGER'
WHERE NOT EXISTS (SELECT 1 FROM utilisateurs WHERE email = 'manager@smartassign.tn');

INSERT INTO utilisateurs (nom, email, mot_de_passe, role)
SELECT 'Collab Demo', 'collab@smartassign.tn',
'$2a$10$wJ8QwQwQwQwQwQwQwQwQwOQwQwQwQwQwQwQwQwQwQwQwQwQwQwQwQ',
'COLLAB'
WHERE NOT EXISTS (SELECT 1 FROM utilisateurs WHERE email = 'collab@smartassign.tn');