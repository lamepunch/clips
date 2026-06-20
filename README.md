# Clips

## Overview

Lamepunch Clips is a way for friends to upload funny video game clips and have them be preserved.

Users register with Discord. Only people in certain Discord servers are allowed access.

When a user decides to upload a clip, we create a video in Stream and then use Uppy to
send the file directly using the mighty [tus](https://tus.io) protocol.

Once a clip has been processed, it can be viewed from the user's profile through the
built-in Stream Player.

## Setup

```sh
npm install

# 1. Database
npm run db:generate                   # generate SQL migrations from schema
npm run db:migrate:local              # apply to local D1

# 2. Secrets
cp .dev.vars.example .dev.vars        # fill in values

# 3. Run
npm run dev
```
