# Video Content Capture

A small, dependency-free Node.js web server that submits authorized YouTube URLs to a background Bash process. Each job downloads the video and captions, creates regularly sampled screenshots, and optionally searches captions for specified terms.

## Prerequisites

- Node.js 20 or newer
- `yt-dlp`
- FFmpeg

Only download videos that you own or have permission to download. The application intentionally accepts only YouTube URLs, passes arguments without shell interpolation, and binds to localhost by default.

## Run

```bash
npm start
```

Open <http://127.0.0.1:3000>, paste a YouTube URL, and submit the job. Results are written under `output/<job-id>/`.

Configuration is available through environment variables:

```bash
HOST=127.0.0.1 PORT=3000 APP_TOKEN='choose-a-secret' npm start
```

When `APP_TOKEN` is set, API requests require an `Authorization: Bearer <token>` header. In a browser, set it for the current tab before using the form:

```js
sessionStorage.setItem('appToken', 'choose-a-secret')
```

Do not expose the server publicly without authentication, TLS, request-rate limiting, and an isolated worker. Jobs run with the same operating-system permissions as the server.

## Output

Each successful job contains:

- The downloaded video and its `yt-dlp` metadata
- Available English manual or automatically generated captions
- JPEG screenshots under `frames/`
- `caption-matches.txt` when search terms were supplied

The screenshot interval is configurable from 1–60 seconds. Caption matching locates spoken terms; it does not perform OCR on text displayed inside the video frames.

## Test

```bash
npm test
```

## Run in GitHub Actions

The **Process YouTube video** workflow can run the same processing script on a GitHub-hosted runner. Configure the repository Actions secret `YOUTUBE_URL`, then open **Actions → Process YouTube video → Run workflow**. You may optionally supply caption search terms and choose the screenshot interval.

The workflow installs FFmpeg and `yt-dlp`, runs the processor, and uploads the downloaded video, metadata, captions, matches, and screenshots as a `processed-video-<run-id>` artifact. Artifacts are retained for seven days and are not committed to the repository.

GitHub only displays a manually dispatched workflow in the Actions UI after the workflow file exists on the repository's default branch. Before this change is merged, a maintainer can instead dispatch it for the PR branch with the GitHub CLI if GitHub recognizes the workflow on that branch:

```bash
gh workflow run process-video.yml --ref <pr-branch>
```

Repository secrets are not made available to workflows triggered from untrusted forked pull requests. Manual dispatch after merging to `main` is the recommended path.
