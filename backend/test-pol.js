const f = async () => {
  try {
    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'What is the capital of France? Return JSON { "capital": "string" }' }],
        jsonMode: true
      })
    })
    console.log(await res.text())
  } catch(e) { console.log(e) }
}
f()
