"""Read WeChatBridge's native transcript ZIP in memory; never extract attachments."""
import json,sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as archive:
    entries=archive.infolist()
    if len(entries)>10000 or sum(x.file_size for x in entries)>1024**3:raise ValueError('archive too large')
    candidates=[x for x in entries if x.filename.lower().endswith('.txt') and x.file_size<=2*1024*1024 and not x.flag_bits&1]
    candidates.sort(key=lambda x:(x.filename.replace('\\','/').split('/')[-1]!='聊天记录.txt',-x.file_size))
    if not candidates:raise ValueError('no transcript')
    text=archive.read(candidates[0]).decode('utf-8-sig')
    print(json.dumps({'text':text},ensure_ascii=False))
