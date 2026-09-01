#!/usr/bin/env bash
set -Eeuo pipefail

url=${1:?video URL is required}
output=${2:?output directory is required}
terms=${3:-}
interval=${4:-5}

for command in yt-dlp ffmpeg; do
  command -v "$command" >/dev/null || { echo "Missing required command: $command" >&2; exit 127; }
done

mkdir -p "$output/frames"
echo "Downloading video, metadata, and available English captions…"
yt-dlp --no-playlist --restrict-filenames --write-info-json --write-subs --write-auto-subs \
  --sub-langs 'en.*' --convert-subs srt --merge-output-format mp4 \
  -o "$output/video.%(ext)s" -- "$url"

video=$(find "$output" -maxdepth 1 -type f \( -name 'video.mp4' -o -name 'video.webm' -o -name 'video.mkv' \) -print -quit)
[[ -n "$video" ]] || { echo 'Downloaded video file was not found.' >&2; exit 1; }

echo "Creating one screenshot every $interval seconds…"
ffmpeg -hide_banner -loglevel warning -i "$video" -vf "fps=1/$interval" -q:v 2 "$output/frames/frame_%06d.jpg"

if [[ -n "$terms" ]]; then
  echo "Searching captions for: $terms"
  : > "$output/caption-matches.txt"
  while IFS= read -r caption; do
    IFS=',' read -ra needles <<< "$terms"
    for needle in "${needles[@]}"; do
      needle=${needle#"${needle%%[![:space:]]*}"}; needle=${needle%"${needle##*[![:space:]]}"}
      [[ -z "$needle" ]] || grep -inF -- "$needle" "$caption" >> "$output/caption-matches.txt" || true
    done
  done < <(find "$output" -maxdepth 1 -type f -name '*.srt' -print)
fi

echo "Finished. Results: $output"
