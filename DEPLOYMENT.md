# Guide de Déploiement - DC Deal Screener

Ce guide vous permet de déployer l'application **sans écrire de code**. Nous utilisons **Railway**, une plateforme qui simplifie le déploiement en quelques clics.

---

## Option 1 : Déploiement sur Railway (Recommandé)

Railway est la solution la plus simple. Elle gère automatiquement la base de données et le déploiement.

### Étape 1 : Créer un compte Railway

1. Allez sur [railway.app](https://railway.app)
2. Cliquez sur **"Login"** puis **"Login with GitHub"**
3. Autorisez Railway à accéder à votre compte GitHub

### Étape 2 : Obtenir une clé OpenAI

1. Allez sur [platform.openai.com](https://platform.openai.com)
2. Créez un compte ou connectez-vous
3. Allez dans **API Keys** → **Create new secret key**
4. Copiez la clé (elle commence par `sk-`)
5. **Important** : Ajoutez du crédit à votre compte OpenAI (minimum $5)

### Étape 3 : Déployer en un clic

1. Cliquez sur ce bouton pour déployer automatiquement :

   [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/dc-deal-screener)

   *Si le lien ne fonctionne pas, suivez l'Étape 3 Alternative ci-dessous.*

### Étape 3 Alternative : Déploiement manuel sur Railway

1. Sur Railway, cliquez sur **"New Project"**
2. Choisissez **"Deploy from GitHub repo"**
3. Sélectionnez le dépôt `DC_Deal_Screener`
4. Railway détecte automatiquement que c'est une app Next.js

### Étape 4 : Ajouter la base de données PostgreSQL

1. Dans votre projet Railway, cliquez sur **"+ New"**
2. Choisissez **"Database"** → **"PostgreSQL"**
3. Railway crée automatiquement la base de données
4. La variable `DATABASE_URL` est ajoutée automatiquement

### Étape 5 : Configurer les variables d'environnement

Dans Railway, allez dans **Variables** et ajoutez :

| Variable | Valeur | Description |
|----------|--------|-------------|
| `NEXTAUTH_SECRET` | *(cliquez Generate)* | Secret d'authentification |
| `NEXTAUTH_URL` | `https://votre-app.railway.app` | URL de votre application |
| `OPENAI_API_KEY` | `sk-...` | Votre clé API OpenAI |
| `OPENAI_MODEL` | `gpt-4o` | Modèle à utiliser |

**Pour générer NEXTAUTH_SECRET :**
- Allez sur [generate-secret.vercel.app](https://generate-secret.vercel.app/32)
- Copiez la valeur générée

### Étape 6 : Premier démarrage

1. Railway redéploie automatiquement après les variables
2. Attendez que le déploiement soit "Success" (2-3 minutes)
3. Cliquez sur le domaine généré (ex: `votre-app.railway.app`)
4. Vous arrivez sur la page `/onboarding` (première fois)

### Étape 7 : Créer votre compte administrateur

Sur la page `/onboarding` :
1. Entrez votre **email**
2. Choisissez un **mot de passe** sécurisé
3. Donnez un **nom** à votre organisation
4. Cliquez **"Create Admin Account"**

**C'est terminé ! Vous pouvez maintenant utiliser l'application.**

---

## Option 2 : Déploiement sur Vercel + Supabase

Alternative si vous préférez Vercel.

### Prérequis
- Compte [Vercel](https://vercel.com)
- Compte [Supabase](https://supabase.com)

### Étapes

1. **Créer une base de données Supabase :**
   - Allez sur Supabase → New Project
   - Copiez la `Connection string` (Database → Settings → Connection string → URI)

2. **Déployer sur Vercel :**
   - Importez le repo GitHub dans Vercel
   - Ajoutez les variables d'environnement :
     - `DATABASE_URL` = URI Supabase
     - `NEXTAUTH_SECRET` = valeur générée
     - `NEXTAUTH_URL` = URL Vercel
     - `OPENAI_API_KEY` = votre clé

3. **Exécuter les migrations :**
   - Dans Vercel, allez dans Settings → Functions
   - Augmentez le timeout à 60 secondes
   - Les migrations s'exécutent au premier déploiement

---

## Configuration du stockage de fichiers (Production)

Par défaut, les fichiers sont stockés localement. Pour la production, utilisez DigitalOcean Spaces :

1. Créez un Space sur [DigitalOcean](https://cloud.digitalocean.com/spaces)
2. Générez des clés API (Spaces access keys)
3. Ajoutez ces variables dans Railway/Vercel :

| Variable | Valeur |
|----------|--------|
| `SPACES_ENDPOINT` | `https://fra1.digitaloceanspaces.com` |
| `SPACES_REGION` | `fra1` |
| `SPACES_ACCESS_KEY` | Votre access key |
| `SPACES_SECRET_KEY` | Votre secret key |
| `SPACES_BUCKET` | Nom de votre Space |

---

## Utilisation de l'application

### Première configuration

1. **Créer un Fund (Fonds d'investissement)**
   - Menu → Funds → Create Fund
   - Configurez votre thèse d'investissement
   - Choisissez un preset de politique (Conservative, Growth, ESG, Hyperscale)

2. **Configurer les Country Packs**
   - Menu → Country Packs
   - Ajoutez les pays où vous investissez
   - Les données officielles (TSO, régulateurs) sont pré-remplies

3. **Créer un Deal**
   - Menu → Deals → New Deal
   - Sélectionnez le Fund, pays, ville, type

### Analyser un deal

1. **Uploader les documents**
   - Ouvrez le deal
   - Uploadez les PDFs de la dataroom
   - Attendez que le statut passe à "Indexed"

2. **Lancer l'analyse**
   - Cochez "Include market research" si souhaité
   - Cliquez "Run Analysis"
   - L'analyse prend 30-60 secondes

3. **Exporter les résultats**
   - **PDF** : Cliquez "Download IC Pack"
   - **CSV** : Utilisez l'URL `/api/deals/{id}/runs/{runId}/export/csv`

---

## Coûts estimés

| Service | Coût mensuel |
|---------|--------------|
| Railway (Hobby) | ~$5/mois |
| PostgreSQL | Inclus dans Railway |
| OpenAI API | ~$10-50/mois (selon usage) |
| DigitalOcean Spaces | ~$5/mois (250GB) |

**Total estimé : $20-60/mois**

---

## Résolution de problèmes

### "OpenAI is not configured"
→ Vérifiez que `OPENAI_API_KEY` est bien définie et commence par `sk-`

### "Database connection failed"
→ Vérifiez que PostgreSQL est bien ajouté dans Railway
→ La variable `DATABASE_URL` doit être automatique

### "Unauthorized" sur login
→ Vérifiez que `NEXTAUTH_SECRET` est définie
→ Vérifiez que `NEXTAUTH_URL` correspond à votre domaine

### Les fichiers ne s'uploadent pas
→ Vérifiez la taille (max 50MB)
→ Vérifiez le format (PDF, DOC, DOCX, TXT, EML uniquement)

### L'analyse retourne "UNKNOWN" partout
→ Les documents sont peut-être scannés (images)
→ Uploadez des PDFs avec texte extractible
→ L'application vous avertira si un document semble être scanné

---

## Support

- Documentation : Ce fichier + README.md
- Issues : [GitHub Issues](https://github.com/TibCVA/DC_Deal_Screener/issues)

---

## Commandes utiles (pour développeurs)

```bash
# Installation locale
pnpm install
cp .env.example .env
# Éditez .env avec vos valeurs
pnpm prisma migrate dev
pnpm dev

# Tests
pnpm check

# Build production
pnpm build
pnpm start
```
