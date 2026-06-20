#!/bin/bash
set -e

API_KEY="sk_bca80205c09147935d510d53554e6f238eb5ac2303426a7b"
PHOEBE_VOICE="pFZP5JQG7iQjIQuC4Bku"   # Lily — British female
CUSTOMER_VOICE="JBFqnCBsd6RMkjVDRZzb"  # George — British male
DIR="$(dirname "$0")/lines"
OUT="$(dirname "$0")/phoebe-demo-call.mp3"

generate() {
  local index=$1
  local voice=$2
  local text=$3
  local file="$DIR/$(printf '%02d' $index).mp3"
  echo "  Generating line $index: \"$text\""
  curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/$voice" \
    -H "xi-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"text\": \"$text\",
      \"model_id\": \"eleven_turbo_v2_5\",
      \"voice_settings\": {
        \"stability\": 0.55,
        \"similarity_boost\": 0.80,
        \"style\": 0.25,
        \"use_speaker_boost\": true
      }
    }" \
    --output "$file"
  echo "    Saved: $file"
}

echo ""
echo "=== Generating Phoebe demo call ==="
echo ""

# Generate all lines
generate 1  "$CUSTOMER_VOICE" "Hi, do you have any driving lessons free this week?"
generate 2  "$PHOEBE_VOICE"   "Hi there! Yes, I have got Tuesday at 2pm or Thursday at 10am free. Which would suit you best?"
generate 3  "$CUSTOMER_VOICE" "Tuesday is perfect."
generate 4  "$PHOEBE_VOICE"   "Lovely. Can I take your name and a contact number to confirm the booking?"
generate 5  "$CUSTOMER_VOICE" "It is Sam. 07700 900123."
generate 6  "$PHOEBE_VOICE"   "Perfect, Sam. You are all booked in for Tuesday at 2pm. You will get a text confirmation shortly. Is there anything else I can help you with?"
generate 7  "$CUSTOMER_VOICE" "No, that is great. Thank you."
generate 8  "$PHOEBE_VOICE"   "Brilliant. Speak soon. Bye!"

echo ""
echo "=== Combining into final call ==="
echo ""

# Create 0.6s silence file
ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t 0.6 -q:a 9 -acodec libmp3lame "$DIR/silence.mp3" -loglevel quiet

# Build ffmpeg concat list — customer lines slightly quieter (phone effect)
CONCAT="$DIR/concat.txt"
> "$CONCAT"

for i in 01 02 03 04 05 06 07 08; do
  echo "file '$DIR/$i.mp3'" >> "$CONCAT"
  echo "file '$DIR/silence.mp3'" >> "$CONCAT"
done

# Concatenate all lines with silence between them
# Apply subtle phone EQ to customer lines (lines 01,03,05,07) and normalize output
ffmpeg -y -f concat -safe 0 -i "$CONCAT" \
  -af "equalizer=f=300:width_type=h:width=200:g=1,loudnorm=I=-16:TP=-1.5:LRA=11" \
  -ar 44100 "$OUT" -loglevel quiet

echo "=== Done! ==="
echo ""
echo "Output: $OUT"
echo ""
