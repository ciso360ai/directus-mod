# Intro

Customize and run [Directus](https://directus.io)

## Prepare the env

Follow the default
[instructions](https://docs.directus.io/contributing/running-locally.html#_4-install-the-dependencies-and-build-the-project)

```
npm install -g pnpm
pnpm install
pnpm -r build
```

If you get the vite build / node error "Reached heap limit Allocation failed", check memory, default 2GB:

```
node -e 'console.log(v8.getHeapStatistics().heap_size_limit/(1024*1024))'
```

increase mem to 4GB or more:

```
export NODE_OPTIONS="--max-old-space-size=4096"
pnpm -r build
```

## Bootstrap

Create .env in ./api:

```
PUBLIC_URL="localhost"
HOST="0.0.0.0"
PORT=8055
KEY="XXX-XXX-YYY-YYY"
SECRET="ZZZ-ZZZ-WWW-WWW"
TELEMETRY=false
DB_CLIENT="sqlite3"
DB_FILENAME="../custom/test.db"
EXTENSIONS_PATH="../custom/extensions"
STORAGE_LOCAL_ROOT="../custom/uploads"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="ChangeMe!"
```

pnpm --dir api cli bootstrap

## Start

Start API in one terminal:

```
pnpm --filter directus dev
```

Start APP in another terminal:

```
pnpm --filter @directus/app dev
```

## Build image

docker buildx build --push --platform linux/amd64,linux/arm64 --tag ciso360ai/directus-mod:latest .

# Sync fork
```
git checkout main
git fetch upstream
```
rebase to the version tag
```
git rebase v9.21.2
git am --show-current-patch
```
fix any conflicts then add a new release in github with a custom tag, eg. v9.21.2-mod
This will create images using git actions

To abort and get back to the state before "git rebase", run "git rebase --abort".
