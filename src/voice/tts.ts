// 语音反馈：用浏览器自带 TTS，0 成本、即时。
let voice: SpeechSynthesisVoice | null = null
function pick() {
  if (voice || typeof speechSynthesis === 'undefined') return
  const vs = speechSynthesis.getVoices()
  voice = vs.find((v) => /zh|Chinese|Yaoyao|Huihui|Xiaoxiao/i.test(v.lang + v.name)) || vs[0] || null
}
if (typeof speechSynthesis !== 'undefined') {
  pick()
  speechSynthesis.onvoiceschanged = pick
}

export function say(text: string) {
  if (!text || typeof speechSynthesis === 'undefined') return
  try {
    speechSynthesis.cancel() // 打断上一句，保证反馈跟手
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-CN'
    u.rate = 1.05
    if (voice) u.voice = voice
    speechSynthesis.speak(u)
  } catch {}
}
