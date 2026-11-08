set +e
sudo apt-get install -y -qq ffmpeg >/dev/null 2>&1
UA="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
{
for m in nopalA nopalVentana nopalradio; do
  u=https://radio.mensajito.mx/$m
  curl -s -A "$UA" --max-time 20 -o /tmp/$m.mp3 "$u"
  echo "== $m: $(stat -c %s /tmp/$m.mp3) bytes in 20s"
  ffmpeg -hide_banner -nostats -i /tmp/$m.mp3 -af volumedetect -f null - 2>&1 | grep -E "Audio:|mean_volume|max_volume"
  ffmpeg -hide_banner -nostats -i /tmp/$m.mp3 -af silencedetect=n=-50dB:d=2 -f null - 2>&1 | grep -E "silence_(start|end|duration)" | head -4
done
echo "== radionopal.com: stream addresses in the page and its scripts"
curl -s -A "$UA" -L --max-time 20 https://www.radionopal.com/ -o /tmp/site.html
grep -oE "https?://[a-zA-Z0-9./_:?=&-]*(mensajito|icecast|stream|:8000|\.mp3|nopal)[a-zA-Z0-9./_:?=&-]*" /tmp/site.html | sort -u | head -20
for js in $(grep -oE '(src|href)="[^"]+\.js[^"]*"' /tmp/site.html | sed -E 's/^(src|href)="//; s/"$//' | head -12); do
  case "$js" in http*) ju="$js";; //*) ju="https:$js";; /*) ju="https://www.radionopal.com$js";; *) ju="https://www.radionopal.com/$js";; esac
  curl -s -A "$UA" --max-time 15 "$ju" | grep -oE "https?://[a-zA-Z0-9./_:?=&-]*(mensajito|icecast|stream|:8000|\.mp3|nopal)[a-zA-Z0-9./_:?=&-]*" | sort -u | sed "s|^|  [$js] |" | head -10
done
} > nopal.txt 2>&1
