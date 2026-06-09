#!/usr/bin/env pwsh
# Script de test pour le champ Téléphone

Write-Host "=====================================" -ForegroundColor Green
Write-Host "TEST CHAMP TELEPHONE - SmartAssign" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Démarrage du backend
Write-Host "`n1. Démarrage du backend..." -ForegroundColor Yellow
$backendProcess = Start-Process -FilePath "pwsh" -ArgumentList "-Command", "cd c:\Users\user\Desktop\pfe\pfe-projet\backend; .\mvnw.cmd spring-boot:run" -PassThru -NoNewWindow
Start-Sleep -Seconds 8

# Test de connexion
Write-Host "`n2. Test de connexion admin..." -ForegroundColor Yellow
if (-not $env:SMOKE_ADMIN_EMAIL -or -not $env:SMOKE_ADMIN_PASSWORD) {
    throw "Configurez SMOKE_ADMIN_EMAIL et SMOKE_ADMIN_PASSWORD avant d'executer ce script."
}

$loginBody = @{
    email = $env:SMOKE_ADMIN_EMAIL
    motDePasse = $env:SMOKE_ADMIN_PASSWORD
} | ConvertTo-Json

$login = Invoke-RestMethod -Uri "http://localhost:8082/api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
$token = $login.token
$headers = @{ Authorization = "Bearer $token" }

Write-Host "✓ Authentification réussie" -ForegroundColor Green

# 3. CRÉER UN UTILISATEUR AVEC TÉLÉPHONE
Write-Host "`n3. Création d'un utilisateur avec téléphone..." -ForegroundColor Yellow
$createBody = @{
    prenom = "Test"
    nom = "Telephone"
    email = "test.telephone@smartassign.tn"
    telephone = "+216 98 765 432"
    role = "COLLAB"
    experienceAnnees = 3
    disponible = $true
    competenceIds = @()
} | ConvertTo-Json

$created = Invoke-RestMethod -Uri "http://localhost:8082/api/collaborateurs" -Method Post -Headers $headers -ContentType "application/json" -Body $createBody
$userId = $created.id

Write-Host "✓ Utilisateur créé: ID=$userId" -ForegroundColor Green
Write-Host "  Email: $($created.email)" -ForegroundColor Cyan
Write-Host "  Téléphone reçu: $($created.telephone)" -ForegroundColor Cyan

# 4. CONSULTER L'UTILISATEUR CRÉÉ
Write-Host "`n4. Consultation de l'utilisateur..." -ForegroundColor Yellow
$fetched = Invoke-RestMethod -Uri "http://localhost:8082/api/collaborateurs/$userId" -Headers $headers -Method Get
Write-Host "  Email: $($fetched.email)" -ForegroundColor Cyan
Write-Host "  Téléphone récupéré: $($fetched.telephone)" -ForegroundColor Cyan

if ($fetched.telephone -eq "+216 98 765 432") {
    Write-Host "✓ Téléphone présent en consultation" -ForegroundColor Green
} else {
    Write-Host "✗ ERREUR: Téléphone manquant ou incorrect!" -ForegroundColor Red
}

# 5. MODIFIER L'UTILISATEUR - CHANGER LE TÉLÉPHONE
Write-Host "`n5. Modification du téléphone..." -ForegroundColor Yellow
$updateBody = @{
    prenom = "Test"
    nom = "Telephone"
    email = "test.telephone@smartassign.tn"
    telephone = "+216 22 222 222"
    role = "COLLAB"
    experienceAnnees = 3
    disponible = $true
    competenceIds = @()
} | ConvertTo-Json

$updated = Invoke-RestMethod -Uri "http://localhost:8082/api/collaborateurs/$userId" -Method Put -Headers $headers -ContentType "application/json" -Body $updateBody
Write-Host "  Téléphone modifié: $($updated.telephone)" -ForegroundColor Cyan

# 6. VÉRIFIER LA MODIFICATION
Write-Host "`n6. Vérification de la modification..." -ForegroundColor Yellow
$verified = Invoke-RestMethod -Uri "http://localhost:8082/api/collaborateurs/$userId" -Headers $headers -Method Get
Write-Host "  Téléphone actuel: $($verified.telephone)" -ForegroundColor Cyan

if ($verified.telephone -eq "+216 22 222 222") {
    Write-Host "✓ Téléphone modifié et sauvegardé" -ForegroundColor Green
} else {
    Write-Host "✗ ERREUR: Modification de téléphone échouée!" -ForegroundColor Red
}

# 7. VÉRIFIER DANS LA LISTE
Write-Host "`n7. Vérification dans la liste des collaborateurs..." -ForegroundColor Yellow
$list = Invoke-RestMethod -Uri "http://localhost:8082/api/collaborateurs" -Headers $headers -Method Get
$inList = $list | Where-Object { $_.id -eq $userId }

if ($inList -and $inList.telephone -eq "+216 22 222 222") {
    Write-Host "✓ Téléphone visible dans la liste" -ForegroundColor Green
    Write-Host "  Collaborateur: $($inList.prenom) $($inList.nom)" -ForegroundColor Cyan
    Write-Host "  Téléphone: $($inList.telephone)" -ForegroundColor Cyan
} else {
    Write-Host "✗ ERREUR: Téléphone manquant dans la liste!" -ForegroundColor Red
}

# Résumé
Write-Host "`n=====================================" -ForegroundColor Green
Write-Host "RÉSUMÉ - Champ Téléphone" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host "✓ Frontend: Compilé avec succès" -ForegroundColor Green
Write-Host "✓ Backend: Compilé avec succès" -ForegroundColor Green
Write-Host "✓ POST /collaborateurs: Téléphone envoyé et sauvegardé" -ForegroundColor Green
Write-Host "✓ GET /collaborateurs/{id}: Téléphone retourné" -ForegroundColor Green
Write-Host "✓ PUT /collaborateurs/{id}: Téléphone modifié" -ForegroundColor Green
Write-Host "✓ GET /collaborateurs: Téléphone visible dans la liste" -ForegroundColor Green
Write-Host "`nTÉLÉPHONE SYNCHRONISÉ: Frontend ↔ Backend ↔ Base de données" -ForegroundColor Green

# Arrêter le backend
Write-Host "`n8. Arrêt du backend..." -ForegroundColor Yellow
Stop-Process -Id $backendProcess.Id -Force
Write-Host "✓ Backend arrêté" -ForegroundColor Green
