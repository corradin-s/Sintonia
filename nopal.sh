set +e
UA="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
{
echo "== status"; curl -s -m 20 https://radio.mensajito.mx/status-json.xsl | python3 -c "
import json,sys
d=json.load(sys.stdin)['icestats']; src=d.get('source') or []; src=src if isinstance(src,list) else [src]
for s in src: print(json.dumps({k:s.get(k) for k in ('listenurl','server_type','audio_info','bitrate','samplerate','listeners','stream_start','title','server_name')}, ensure_ascii=False))"
for u in https://radio.mensajito.mx/nopalA https://radio.mensajito.mx/nopalVentana; do
  echo "== headers $u"; curl -s -m 12 -A "$UA" -D - -o /tmp/s.bin --max-time 12 -H "Origin: https://corradin-s.github.io" "$u" | tr -d '\r' | head -25
  ls -l /tmp/s.bin; file /tmp/s.bin
  echo "-- loudness of 12s"; ffmpeg -hide_banner -nostats -i /tmp/s.bin -af volumedetect -f null - 2>&1 | grep -E "Stream|mean_volume|max_volume|Input"
done
echo "== range / HEAD (Safari asks for a range first)"; curl -s -m 10 -A "$UA" -r 0-1 -D - -o /dev/null https://radio.mensajito.mx/nopalA | tr -d '\r' | head -12
} > nopal.txt 2>&1
