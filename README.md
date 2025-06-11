# chatgpt-extensions
For ChatGPT power users.

A collection of lightweight userscripts for Tampermonkey that enhance the ChatGPT web interface with minimal fuss.

---

## ⚙️ GPT Model Picker & Force Model (`gpt.js`)

**Activation:** Press **⌘ + ⇧ + 1** anywhere on chatgpt.com  
**What it does:**
- Opens a centered dark overlay with a list of available models  
- Lets you type a few characters to fuzzy-filter (“4.1”, “omh”, etc.)  
- Navigate with ↑/↓ or click, then press Enter to pick  
- Remembers your choice and applies it to every new message  
- Keeps the script’s selection in sync with ChatGPT’s own model menu (still buggy)

---

## 📥 Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome/Firefox/Edge)  
2. Create a new userscript and paste in `gpt.js`  
3. Save and reload **https://chatgpt.com/**  

---

## 🔍 Features (for end users)

- **Model switching with fuzzy-find:** type part of a model name to filter  
- **Persistent selection:** your chosen model is used for every conversation  
- **Visual overlay:** appears in the middle of the screen, matches ChatGPT’s theme  
- **UI synchronization:** when ChatGPT’s own model menu changes, the script follows it  

---

## 👩‍💻 For Developers

- **Easy to extend:** just update the `MODELS` array with new IDs/labels  
- **Fetch interceptor:** injects your chosen model into every chat request  
- **Scoped listeners:** keyboard and click handlers only active while the picker is open  
- **Debounced filtering:** ensures typing in the picker stays snappy  

---

## 🤝 Contributing & Collaboration

Pull requests and collaboration are warmly welcomed!  
If you have ideas for new features, model updates, performance tweaks, or just want to learn by contributing, feel free to:

1. **Fork the repo** and open a PR with your changes  
2. **Open an issue** to discuss ideas, bugs, or enhancements  
3. **Join the conversation** in discussions to help shape future scripts  

Whether it’s refining the fuzzy-find logic, adding new models, or improving the UI—you’re invited to jump in and help make ChatGPT even smoother for everyone.

---
## 🤖 Built with ChatGPT

This userscript was crafted through an interactive session with ChatGPT over a 2hr period:

1. **Prototype:** started with a simple Tampermonkey script to open and engage with the ChatGPT model dropdown. This proved too difficult to reverse-engineer.
2. **Pivot:** after exploring network calls made when a new chat was sent, pivoted to adding a fetch override to force the chosen model on outgoing requests
3. **UI polish:** iterated on a dark-themed overlay, fuzzy search, arrow/Enter navigation  
4. **Optimization:** scoped event handlers and debounced input for minimal page impact.
5. **Final review:** refined naming, styling, and readme language through multiple ChatGPT prompts. I avoided doing work myself as much as possible and delegated to ChatGPT, preferring to give it high-level ideas and hints.

Each step was guided by ChatGPT—specifically leveraging the GPT-4o, o4-mini-high, GPT-4.5, and GPT-4.1-mini models.  
