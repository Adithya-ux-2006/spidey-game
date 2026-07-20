"use strict";

const app = document.getElementById("app");
const STORAGE_KEY = "spiderVerseNoirAiSave";

const gameMeta = [
  {
    id: "connections",
    title: "Connections",
    variant: "SPIDER-NOIR",
    blurb: "Detective-board clues, red yarn, and NYT-style misdirection.",
    icon: "assets/spider-noir.svg",
    glow: "rgba(230, 214, 176, 0.42)"
  },
  {
    id: "ai-picture",
    title: "Choose the AI Picture",
    variant: "SPIDER-MAN IN THE SPIDERVERSE",
    blurb: "Scan Stark-style image feeds and catch the generated one.",
    icon: "assets/spider-iron.svg",
    glow: "rgba(246, 200, 95, 0.44)"
  }
];

const defaultSave = {
  highScores: {
    connections: 0,
    "ai-picture": 0
  },
  lastPlayedGame: "",
  homeMode: "quadrants",
  darkMode: true,
  soundOn: false
};

let save = loadSave();
let currentCleanup = null;
let audioContext = null;

const gameState = {
  connections: null,
  aiPicture: null
};

function loadSave() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...defaultSave,
      ...stored,
      highScores: {
        ...defaultSave.highScores,
        ...(stored.highScores || {})
      }
    };
  } catch {
    return JSON.parse(JSON.stringify(defaultSave));
  }
}

function persistSave() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  syncTheme();
}

function syncTheme() {
  document.body.classList.toggle("light-mode", !save.darkMode);
}

function syncChromeLabels() {
  document.querySelectorAll("[data-dark-toggle]").forEach((button) => {
    button.textContent = save.darkMode ? "Light" : "Dark";
    button.setAttribute("aria-label", save.darkMode ? "Switch to light mode" : "Switch to dark mode");
  });
  document.querySelectorAll("[data-sound-toggle]").forEach((button) => {
    button.textContent = save.soundOn ? "Sound On" : "Sound Off";
    button.setAttribute("aria-label", save.soundOn ? "Turn sound off" : "Turn sound on");
  });
  document.querySelectorAll("[data-home-mode-toggle]").forEach((button) => {
    button.textContent = save.homeMode === "menu" ? "Quadrants" : "Menu";
    button.setAttribute("aria-label", save.homeMode === "menu" ? "Show quadrant home" : "Show menu home");
  });
}

function setupChrome() {
  app.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.route));
  });
  app.querySelectorAll("[data-home]").forEach((button) => {
    button.addEventListener("click", () => navigate("home"));
  });
  app.querySelectorAll("[data-back]").forEach((button) => {
    button.addEventListener("click", goBack);
  });
  app.querySelectorAll("[data-dark-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      save.darkMode = !save.darkMode;
      persistSave();
      syncChromeLabels();
      playSound("click");
    });
  });
  app.querySelectorAll("[data-sound-toggle]").forEach((button) => {
    button.addEventListener("click", async () => {
      save.soundOn = !save.soundOn;
      persistSave();
      syncChromeLabels();
      if (save.soundOn) {
        await ensureAudio();
        playSound("click");
      }
    });
  });
  app.querySelectorAll("[data-home-mode-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      save.homeMode = save.homeMode === "menu" ? "quadrants" : "menu";
      persistSave();
      playSound("click");
      renderHome();
    });
  });
  syncChromeLabels();
}

function navigate(route) {
  if (route !== "home") {
    save.lastPlayedGame = route;
    persistSave();
  }
  playSound("click");
  const target = route === "home" ? "" : route;
  if (location.hash.replace("#", "") === target) {
    renderRoute();
  } else {
    location.hash = target;
  }
}

function goBack() {
  playSound("click");
  if (history.length > 1 && location.hash) {
    history.back();
    setTimeout(() => {
      if (location.hash) return;
      renderRoute();
    }, 80);
  } else {
    navigate("home");
  }
}

function setView(markup, setup) {
  if (typeof currentCleanup === "function") {
    currentCleanup();
  }
  currentCleanup = null;
  app.innerHTML = markup;
  setupChrome();
  requestAnimationFrame(() => {
    const view = app.querySelector(".view");
    if (view) view.classList.add("is-visible");
  });
  if (typeof setup === "function") {
    currentCleanup = setup() || null;
  }
}

function renderRoute() {
  syncTheme();
  const route = location.hash.replace("#", "") || "home";
  document.body.dataset.route = route;
  if (route === "home") return renderHome();
  if (route === "connections") return renderConnections();
  if (route === "ai-picture") return renderAiPicture();
  navigate("home");
}

function chromeHome() {
  return `
    <header class="topbar">
      <div class="brand">
        <img src="assets/spider.svg" alt="">
        <span>Spider-Verse Arcade</span>
      </div>
      <div class="nav-actions">
        <button class="btn small" type="button" data-home-mode-toggle>Menu</button>
        <button class="btn small" type="button" data-dark-toggle>Dark</button>
        <button class="btn small" type="button" data-sound-toggle>Sound Off</button>
      </div>
    </header>
  `;
}

function chromeGame(title) {
  return `
    <header class="topbar">
      <div class="game-nav">
        <button class="btn small" type="button" data-back>Back</button>
        <button class="btn small" type="button" data-home>Home</button>
      </div>
      <h2>${escapeHtml(title)}</h2>
      <div class="nav-actions">
        <button class="btn small" type="button" data-dark-toggle>Dark</button>
        <button class="btn small" type="button" data-sound-toggle>Sound Off</button>
      </div>
    </header>
  `;
}

function gameShell(id, title, content) {
  return `
    <main class="view game-shell" data-game="${id}">
      ${chromeGame(title)}
      <section class="game-panel">
        <div class="panel-inner">${content}</div>
      </section>
    </main>
  `;
}

function renderHome() {
  const lastGame = gameMeta.find((game) => game.id === save.lastPlayedGame);
  const cards = gameMeta.map((game) => `
    <button class="game-card" type="button" data-route="${game.id}" style="--card-glow: ${game.glow}">
      <img class="card-icon" src="${game.icon}" alt="">
      <div>
        <span class="variant-label">${game.variant}</span>
        <h3>${game.title}</h3>
        <p>${game.blurb}</p>
        <p class="mini-stat">${scoreLabel(game.id)}</p>
      </div>
    </button>
  `).join("");
  const quadrants = gameMeta.map((game) => `
    <button class="home-quadrant home-quadrant-${game.id}" type="button" data-route="${game.id}" style="--card-glow: ${game.glow}">
      <span class="variant-art" aria-hidden="true"></span>
      <img class="card-icon" src="${game.icon}" alt="">
      <div>
        <span class="variant-label">${game.variant}</span>
        <h3>${game.title}</h3>
        <p>${game.blurb}</p>
        <p class="mini-stat">${scoreLabel(game.id)}</p>
      </div>
    </button>
  `).join("");

  setView(`
    <main class="view">
      ${chromeHome()}
      <section class="hero">
        <div class="hero-copy">
          <span class="kicker">Friendly Neighborhood Arcade</span>
          <h1>Spider-Verse Mini Games</h1>
          <p>Two Spider-variant mini games in one local page, with web-slung transitions, parallax textures, and saved scores.</p>
          ${lastGame ? `<p class="last-played">Last played: <strong>${lastGame.title}</strong></p>` : ""}
        </div>
      </section>
      ${save.homeMode === "menu"
        ? `<section class="menu-grid" aria-label="Game menu">${cards}</section>`
        : `<section class="quadrant-grid" aria-label="Game menu">${quadrants}</section>`
      }
    </main>
  `);
}

function scoreLabel(id) {
  const value = save.highScores[id] || 0;
  if (id === "connections") return `Best score ${value}`;
  if (id === "ai-picture") return `Best score ${value}`;
  return "";
}

async function ensureAudio() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioContext = new AudioCtx();
  }
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  return audioContext;
}

function playSound(type) {
  if (!save.soundOn) return;
  ensureAudio().then((ctx) => {
    if (!ctx) return;
    const profiles = {
      click: [420, 0.05, "square", 0.04],
      web: [720, 0.12, "sawtooth", 0.06],
      victory: [880, 0.22, "triangle", 0.08],
      error: [150, 0.16, "sawtooth", 0.08]
    };
    const [freq, duration, typeName, gainLevel] = profiles[type] || profiles.click;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = typeName;
    oscillator.frequency.value = freq;
    gain.gain.value = gainLevel;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    oscillator.stop(ctx.currentTime + duration + 0.02);
  }).catch(() => {});
}

function shuffle(array) {
  const copy = array.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function lettersOnly(value) {
  return value.replace(/[^a-z]/gi, "").toUpperCase();
}



  const connectionSets = {
  villainsOne: [
    {
      title: "Case File: Rogues Gallery",
      groups: [
        { name: "Classic Villains", hint: "One of Spider-Man's earliest recurring foes.", color: "#e8d9b7", words: ["Vulture", "Rhino", "Scorpion", "Shocker"] },
        { name: "Sinister Six Members", hint: "Part of the villain team that first teamed up against Spidey.", color: "#d8c09a", words: ["Doc Ock", "Electro", "Sandman", "Kraven"] },
        { name: "Symbiote Villains", hint: "Comes with a black alien suit.", color: "#c9aa76", words: ["Venom", "Carnage", "Riot", "Toxin"] },
        { name: "Villains' Real Names", hint: "The name behind the mask.", color: "#a33a2f", words: ["Norman Osborn", "Otto Octavius", "Flint Marko", "Max Dillon"] }
      ]
    }
  ],
  villainsTwo: [
    {
      title: "Case File: Underworld Ledger",
      groups: [
        { name: "Underworld Bosses", hint: "Runs the criminal underworld of New York.", color: "#e8d9b7", words: ["Kingpin", "Hammerhead", "Tombstone", "Silvermane"] },
        { name: "Masters of Disguise", hint: "A villain known for illusions or disguises.", color: "#d8c09a", words: ["Mysterio", "Chameleon", "Hobgoblin", "Jack O'Lantern"] },
        { name: "Symbiote Hosts", hint: "A person who has worn a symbiote.", color: "#c9aa76", words: ["Eddie Brock", "Cletus Kasady", "Flash Thompson", "Mac Gargan"] },
        { name: "Animal-Inspired Villains", hint: "Named after a creature.", color: "#a33a2f", words: ["Lizard", "Beetle", "Vulture", "Scorpion"] }
      ]
    }
  ],
  variantsOne: [
    {
      title: "Case File: Spider-Verse Dossier I",
      groups: [
        { name: "Spider Variants", hint: "An alternate-universe Spider-Man.", color: "#e8d9b7", words: ["Spider-Noir", "Spider-Punk", "Spider-Ham", "Scarlet Spider"] },
        { name: "2099 Universe", hint: "Tied to the futuristic Spider-Man 2099.", color: "#d8c09a", words: ["Miguel O'Hara", "Alchemax", "Neon City", "Lyla"] },
        { name: "Multiverse Terms", hint: "A designation for a specific universe.", color: "#c9aa76", words: ["Earth-616", "Earth-42", "Earth-65", "Spider-Verse"] },
        { name: "Variant Signature Traits", hint: "A signature ability of a Spider variant.", color: "#a33a2f", words: ["Web Wings", "Detective Instincts", "Sonic Guitar", "Toon Force"] }
      ]
    }
  ],
  variantsTwo: [
    {
      title: "Case File: Spider-Verse Dossier II",
      groups: [
        { name: "More Spider Variants", hint: "Another hero who wears a spider emblem.", color: "#e8d9b7", words: ["Miles Morales", "Spider-Woman", "Spider-Man India", "Spider-Girl"] },
        { name: "Web-Slinger Nicknames", hint: "A nickname fans use for Spider-Man.", color: "#d8c09a", words: ["Web-Head", "Wall-Crawler", "Spidey", "Friendly Neighborhood"] },
        { name: "Spider Society Terms", hint: "A term from the Spider-Society lore.", color: "#c9aa76", words: ["Canon Event", "Spider-Society", "Multiverse", "Anomaly"] },
        { name: "Iconic Spider Suits", hint: "A costume Peter has worn.", color: "#a33a2f", words: ["Advanced Suit", "Iron Spider", "Stealth Suit", "Symbiote Suit"] }
      ]
    }
  ],
  miscOne: [
    {
      title: "Case File: Queens Clues",
      groups: [
        { name: "Peter's Circle", hint: "Someone close to Peter Parker.", color: "#e8d9b7", words: ["MJ", "Ned", "Aunt May", "Gwen"] },
        { name: "Spider Gadgets", hint: "Equipment built into the suit.", color: "#d8c09a", words: ["Web-Shooters", "Spider-Tracer", "Web Wings", "Impact Webbing"] },
        { name: "Daily Bugle Terms", hint: "Associated with the newspaper Peter works for.", color: "#c9aa76", words: ["J. Jonah Jameson", "Betty Brant", "Robbie Robertson", "Front Page"] },
        { name: "Spider Powers", hint: "An ability from the spider bite.", color: "#a33a2f", words: ["Spider-Sense", "Wall-Crawling", "Super Strength", "Web-Slinging"] }
      ]
    }
  ],
  miscTwo: [
    {
      title: "Case File: Comics And Lore",
      groups: [
        { name: "Comic Runs", hint: "The title of a long-running comic series.", color: "#e8d9b7", words: ["Amazing Spider-Man", "Ultimate Spider-Man", "Spectacular Spider-Man", "Web of Spider-Man"] },
        { name: "Spider-Man Video Games", hint: "A Spider-Man game you could play.", color: "#d8c09a", words: ["Spider-Man 2", "Miles Morales", "Web of Shadows", "Shattered Dimensions"] },
        { name: "NYC Locations", hint: "A place you'd find in Spider-Man's New York.", color: "#c9aa76", words: ["Queens", "Oscorp Tower", "Daily Bugle", "Chrysler Building"] },
        { name: "Spidey Concepts", hint: "A phrase closely tied to Spider-Man's identity.", color: "#a33a2f", words: ["Great Power", "Friendly Neighborhood", "Web-Slinging", "Puny Parker"] }
      ]
    }
  ],

  techLanguages: [
    {
      title: "Case File: Language Ledger",
      groups: [
        { name: "Compiled Languages", hint: "A language that's translated to machine code before running.", color: "#e8d9b7", words: ["C", "C++", "Rust", "Go"] },
        { name: "Scripting Languages", hint: "A language typically run without a separate compile step.", color: "#d8c09a", words: ["Python", "Ruby", "Perl", "Lua"] },
        { name: "JVM Languages", hint: "A language that runs on the Java Virtual Machine.", color: "#c9aa76", words: ["Java", "Kotlin", "Scala", "Clojure"] },
        { name: "Web Languages", hint: "A language central to building web pages.", color: "#a33a2f", words: ["JavaScript", "TypeScript", "HTML", "CSS"] },
      ]
    }
  ],
  techCloud: [
    {
      title: "Case File: Cloud Dossier",
      groups: [
        { name: "Cloud Providers", hint: "A major public cloud platform.", color: "#e8d9b7", words: ["AWS", "Azure", "GCP", "IBM Cloud"] },
        { name: "Containerization Tools", hint: "Used to package and run isolated application environments.", color: "#d8c09a", words: ["Docker", "Kubernetes", "Podman", "containerd"] },
        { name: "CI/CD Tools", hint: "Automates building, testing, and deploying code.", color: "#c9aa76", words: ["Jenkins", "GitHub Actions", "CircleCI", "Travis CI"] },
        { name: "Infrastructure as Code Tools", hint: "Defines infrastructure using configuration files.", color: "#a33a2f", words: ["Terraform", "Ansible", "Pulumi", "CloudFormation"] },
      ]
    }
  ],
  techVersionControl: [
    {
      title: "Case File: Repo Files",
      groups: [
        { name: "Git Commands", hint: "An action you run in Git.", color: "#e8d9b7", words: ["Commit", "Merge", "Rebase", "Checkout"] },
        { name: "Git Hosting Platforms", hint: "A site where repositories are hosted.", color: "#d8c09a", words: ["GitHub", "GitLab", "Bitbucket", "SourceForge"] },
        { name: "Branching Strategies", hint: "An approach to organizing branches in a repo.", color: "#c9aa76", words: ["Gitflow", "Trunk-Based", "Feature Branching", "Forking Workflow"] },
        { name: "Code Review Terms", hint: "Related to reviewing proposed code changes.", color: "#a33a2f", words: ["Pull Request", "Diff", "Approve", "Squash"] },
      ]
    }
  ],
  techDatabases: [
    {
      title: "Case File: Data Vault",
      groups: [
        { name: "Relational Databases", hint: "A database organized into tables with rows and columns.", color: "#e8d9b7", words: ["MySQL", "PostgreSQL", "Oracle", "SQLite"] },
        { name: "NoSQL Databases", hint: "A database that doesn't rely on rigid table schemas.", color: "#d8c09a", words: ["MongoDB", "Cassandra", "Redis", "CouchDB"] },
        { name: "Database Concepts", hint: "A core idea in database design.", color: "#c9aa76", words: ["Index", "Schema", "Normalization", "Transaction"] },
        { name: "Query Languages", hint: "A language used to query data.", color: "#a33a2f", words: ["SQL", "GraphQL", "SPARQL", "PromQL"] },
      ]
    }
  ],
  techNetworking: [
    {
      title: "Case File: Network Grid",
      groups: [
        { name: "Network Protocols", hint: "A set of rules for exchanging data over a network.", color: "#e8d9b7", words: ["TCP", "UDP", "HTTP", "FTP"] },
        { name: "Network Hardware", hint: "A physical device used to connect or manage a network.", color: "#d8c09a", words: ["Router", "Switch", "Modem", "Hub"] },
        { name: "OSI Model Layers", hint: "A layer in the OSI networking model.", color: "#c9aa76", words: ["Data Link", "Transport", "Session", "Presentation"] },
        { name: "Security Concepts", hint: "A term related to protecting network traffic.", color: "#a33a2f", words: ["VPN", "Encryption", "Firewall", "Intrusion Detection"] },
      ]
    }
  ],
  techCybersecurity: [
    {
      title: "Case File: Breach Report",
      groups: [
        { name: "Attack Types", hint: "A method used to compromise a system.", color: "#e8d9b7", words: ["Phishing", "Ransomware", "DDoS", "Malware"] },
        { name: "Security Roles", hint: "A job title in cybersecurity.", color: "#d8c09a", words: ["Pentester", "SOC Analyst", "CISO", "Red Teamer"] },
        { name: "Security Concepts", hint: "A guiding principle in security design.", color: "#c9aa76", words: ["Zero Trust", "Least Privilege", "Sandboxing", "Threat Model"] },
        { name: "Famous Vulnerabilities", hint: "A well-known named security flaw.", color: "#a33a2f", words: ["Heartbleed", "Log4Shell", "Shellshock", "Spectre"] },
      ]
    }
  ],
  techAI: [
    {
      title: "Case File: Neural Files",
      groups: [
        { name: "ML Model Types", hint: "A type of machine learning model.", color: "#e8d9b7", words: ["Neural Network", "Decision Tree", "Random Forest", "SVM"] },
        { name: "AI Companies", hint: "A company known for AI research or products.", color: "#d8c09a", words: ["OpenAI", "DeepMind", "Anthropic", "Cohere"] },
        { name: "ML Concepts", hint: "A concept involved in training models.", color: "#c9aa76", words: ["Overfitting", "Gradient Descent", "Backpropagation", "Regularization"] },
        { name: "AI Terms", hint: "A term you'd hear discussing large language models.", color: "#a33a2f", words: ["Transformer", "Embedding", "Token", "Inference"] },
      ]
    }
  ],
  techDataStructures: [
    {
      title: "Case File: Structure & Sort",
      groups: [
        { name: "Data Structures", hint: "A way of organizing data in memory.", color: "#e8d9b7", words: ["Stack", "Queue", "Heap", "Trie"] },
        { name: "Sorting Algorithms", hint: "An algorithm that orders a list.", color: "#d8c09a", words: ["QuickSort", "MergeSort", "BubbleSort", "HeapSort"] },
        { name: "Graph Algorithms", hint: "An algorithm used for traversing or pathing on graphs.", color: "#c9aa76", words: ["Dijkstra", "BFS", "DFS", "A*"] },
        { name: "Complexity Terms", hint: "A term used to describe algorithm efficiency.", color: "#a33a2f", words: ["Big O", "Time Complexity", "Space Complexity", "Amortized"] },
      ]
    }
  ],
  techOS: [
    {
      title: "Case File: Kernel Panic",
      groups: [
        { name: "OS Families", hint: "A major family of operating systems.", color: "#e8d9b7", words: ["Linux", "Windows", "macOS", "Unix"] },
        { name: "Linux Distributions", hint: "A specific flavor of Linux.", color: "#d8c09a", words: ["Ubuntu", "Fedora", "Debian", "Arch"] },
        { name: "OS Concepts", hint: "A core concept inside an operating system.", color: "#c9aa76", words: ["Kernel", "Process", "Thread", "Scheduler"] },
        { name: "Shell Types", hint: "A command-line shell.", color: "#a33a2f", words: ["Bash", "Zsh", "PowerShell", "Fish"] },
      ]
    }
  ],
  techWebDev: [
    {
      title: "Case File: Frontend Files",
      groups: [
        { name: "Frontend Frameworks", hint: "A framework for building user interfaces.", color: "#e8d9b7", words: ["React", "Vue", "Angular", "Svelte"] },
        { name: "Backend Frameworks", hint: "A framework for building server-side applications.", color: "#d8c09a", words: ["Express", "Django", "Flask", "Rails"] },
        { name: "CSS Concepts", hint: "A concept used in styling web pages.", color: "#c9aa76", words: ["Flexbox", "Grid", "Specificity", "Cascade"] },
        { name: "Web Terms", hint: "A fundamental term in web development.", color: "#a33a2f", words: ["DOM", "API", "Cookie", "Cache"] },
      ]
    }
  ],
  techBigCompanies: [
    {
      title: "Case File: Corporate Ledger",
      groups: [
        { name: "Consumer Tech Giants", hint: "A massive consumer-facing tech company.", color: "#e8d9b7", words: ["Apple", "Amazon", "Meta", "Google"] },
        { name: "Chip Makers", hint: "A company that designs or manufactures processors.", color: "#d8c09a", words: ["Intel", "AMD", "Nvidia", "Qualcomm"] },
        { name: "Enterprise Software Giants", hint: "A major enterprise software company.", color: "#c9aa76", words: ["Microsoft", "Oracle", "SAP", "Salesforce"] },
        { name: "Chinese Tech Giants", hint: "A leading tech company based in China.", color: "#a33a2f", words: ["Alibaba", "Tencent", "Baidu", "Xiaomi"] },
      ]
    }
  ],
  techSocialApps: [
    {
      title: "Case File: App Directory",
      groups: [
        { name: "Social Platforms", hint: "An app built around sharing posts publicly.", color: "#e8d9b7", words: ["Instagram", "TikTok", "Snapchat", "X"] },
        { name: "Messaging Apps", hint: "An app built primarily for private messaging.", color: "#d8c09a", words: ["WhatsApp", "Telegram", "Signal", "Discord"] },
        { name: "Streaming Services", hint: "A service for streaming shows and movies.", color: "#c9aa76", words: ["Netflix", "Hulu", "Disney+", "Max"] },
        { name: "Music Apps", hint: "A service for streaming music.", color: "#a33a2f", words: ["Spotify", "Apple Music", "Tidal", "SoundCloud"] },
      ]
    }
  ],
  techHardware: [
    {
      title: "Case File: Component Log",
      groups: [
        { name: "PC Components", hint: "A core part inside a desktop computer.", color: "#e8d9b7", words: ["CPU", "GPU", "RAM", "Motherboard"] },
        { name: "Storage Types", hint: "A type of data storage medium.", color: "#d8c09a", words: ["SSD", "HDD", "NVMe", "eMMC"] },
        { name: "Peripherals", hint: "A device you connect to a computer.", color: "#c9aa76", words: ["Keyboard", "Monitor", "Mouse", "Webcam"] },
        { name: "Mobile Components", hint: "A part found inside a smartphone.", color: "#a33a2f", words: ["Battery", "Sensor", "Antenna", "Display"] },
      ]
    }
  ],
  techSpace: [
    {
      title: "Case File: Orbital Files",
      groups: [
        { name: "Space Companies", hint: "A private company that builds rockets or spacecraft.", color: "#e8d9b7", words: ["SpaceX", "Blue Origin", "Virgin Galactic", "Rocket Lab"] },
        { name: "Spacecraft", hint: "The name of a specific spacecraft.", color: "#d8c09a", words: ["Dragon", "Starship", "Falcon 9", "Orion"] },
        { name: "Space Agencies", hint: "A national or international space agency.", color: "#c9aa76", words: ["NASA", "ESA", "ISRO", "Roscosmos"] },
        { name: "Space Terms", hint: "A term used to describe spaceflight.", color: "#a33a2f", words: ["Orbit", "Payload", "Booster", "Reentry"] },
      ]
    }
  ],
  techFileFormats: [
    {
      title: "Case File: Format Index",
      groups: [
        { name: "Image Formats", hint: "A common file format for images.", color: "#e8d9b7", words: ["JPEG", "PNG", "GIF", "WebP"] },
        { name: "Document Formats", hint: "A common file format for documents.", color: "#d8c09a", words: ["PDF", "DOCX", "TXT", "RTF"] },
        { name: "Audio Formats", hint: "A common file format for audio.", color: "#c9aa76", words: ["MP3", "WAV", "FLAC", "AAC"] },
        { name: "Video Formats", hint: "A common file format for video.", color: "#a33a2f", words: ["MP4", "MOV", "AVI", "MKV"] },
      ]
    }
  ],
  techConcepts: [
    {
      title: "Case File: Pattern Files",
      groups: [
        { name: "OOP Concepts", hint: "A pillar of object-oriented programming.", color: "#e8d9b7", words: ["Inheritance", "Polymorphism", "Encapsulation", "Abstraction"] },
        { name: "Functional Programming", hint: "A concept central to functional programming.", color: "#d8c09a", words: ["Pure Function", "Immutability", "Recursion", "Higher-Order Function"] },
        { name: "Design Patterns", hint: "A classic reusable software design pattern.", color: "#c9aa76", words: ["Singleton", "Factory", "Observer", "Adapter"] },
        { name: "Testing Terms", hint: "A term used when testing code.", color: "#a33a2f", words: ["Unit Test", "Mock", "Assertion", "Coverage"] },
      ]
    }
  ],
  techInternetHistory: [
    {
      title: "Case File: Legacy Web",
      groups: [
        { name: "Early Browsers", hint: "A web browser from the early internet era.", color: "#e8d9b7", words: ["Netscape", "Mosaic", "Internet Explorer", "Lynx"] },
        { name: "Search Engines", hint: "A service used to search the web.", color: "#d8c09a", words: ["Google", "Bing", "Yahoo", "DuckDuckGo"] },
        { name: "Internet Protocols", hint: "A foundational protocol of the internet.", color: "#c9aa76", words: ["HTTP", "DNS", "SMTP", "IMAP"] },
        { name: "Web Eras", hint: "A term describing an era of the web.", color: "#a33a2f", words: ["Web 1.0", "Web 2.0", "Web3", "Semantic Web"] },
      ]
    }
  ],
  techAcronyms: [
    {
      title: "Case File: Acronym Archive",
      groups: [
        { name: "Networking Acronyms", hint: "An abbreviation you'd hear in networking.", color: "#e8d9b7", words: ["LAN", "WAN", "VPN", "ISP"] },
        { name: "Storage Acronyms", hint: "An abbreviation related to data storage.", color: "#d8c09a", words: ["RAID", "SSD", "NAS", "SAN"] },
        { name: "Dev Acronyms", hint: "An abbreviation a developer uses daily.", color: "#c9aa76", words: ["API", "SDK", "IDE", "CLI"] },
        { name: "Security Acronyms", hint: "An abbreviation related to security.", color: "#a33a2f", words: ["2FA", "SSL", "TLS", "CVE"] },
      ]
    }
  ],
  techGaming: [
    {
      title: "Case File: Game Dev Files",
      groups: [
        { name: "Game Engines", hint: "Software used to build video games.", color: "#e8d9b7", words: ["Unity", "Unreal", "Godot", "CryEngine"] },
        { name: "Consoles", hint: "A dedicated gaming device.", color: "#d8c09a", words: ["PlayStation", "Xbox", "Switch", "Steam Deck"] },
        { name: "Graphics APIs", hint: "An interface used to render graphics.", color: "#c9aa76", words: ["DirectX", "OpenGL", "Vulkan", "Metal"] },
        { name: "Balance Terms", hint: "A word used when a game gets rebalanced.", color: "#a33a2f", words: ["Meta", "Nerf", "Buff", "Patch"] },
      ]
    }
  ],
  techStartups: [
    {
      title: "Case File: Founder's Ledger",
      groups: [
        { name: "Startup Terms", hint: "A term common in early-stage startup life.", color: "#e8d9b7", words: ["MVP", "Runway", "Pivot", "Bootstrapping"] },
        { name: "Funding Rounds", hint: "A stage of startup fundraising.", color: "#d8c09a", words: ["Seed", "Series A", "Series B", "IPO"] },
        { name: "Investor Types", hint: "A type of startup investor.", color: "#c9aa76", words: ["Angel Investor", "VC", "Accelerator", "LP"] },
        { name: "Business Metrics", hint: "A metric startups track closely.", color: "#a33a2f", words: ["ARR", "Churn", "CAC", "LTV"] },
      ]
    }
  ],
  techCrypto: [
    {
      title: "Case File: Chain Files",
      groups: [
        { name: "Blockchain Concepts", hint: "A core concept behind blockchain technology.", color: "#e8d9b7", words: ["Blockchain", "Hash", "Ledger", "Consensus"] },
        { name: "Cryptocurrencies", hint: "The name of a cryptocurrency.", color: "#d8c09a", words: ["Bitcoin", "Ethereum", "Litecoin", "Dogecoin"] },
        { name: "Wallet Terms", hint: "A term related to storing crypto.", color: "#c9aa76", words: ["Private Key", "Seed Phrase", "Cold Storage", "Public Key"] },
        { name: "Crypto Exchanges", hint: "A platform for trading cryptocurrency.", color: "#a33a2f", words: ["Coinbase", "Binance", "Kraken", "Gemini"] },
      ]
    }
  ],
  techRobotics: [
    {
      title: "Case File: Automation Log",
      groups: [
        { name: "Robotics Terms", hint: "A term used in robotics engineering.", color: "#e8d9b7", words: ["Actuator", "Servo", "Kinematics", "End Effector"] },
        { name: "Robotics Companies", hint: "A company known for building robots.", color: "#d8c09a", words: ["Boston Dynamics", "iRobot", "ABB", "FANUC"] },
        { name: "Automation Concepts", hint: "A concept related to automating workflows.", color: "#c9aa76", words: ["RPA", "Workflow", "Trigger", "Pipeline"] },
        { name: "Famous Robots", hint: "The name of a well-known real-world robot.", color: "#a33a2f", words: ["Sophia", "Atlas", "Spot", "Optimus"] },
      ]
    }
  ],
  techTools: [
    {
      title: "Case File: Toolchain Files",
      groups: [
        { name: "Text Editors", hint: "A tool used to write and edit code.", color: "#e8d9b7", words: ["VS Code", "Vim", "Sublime Text", "Atom"] },
        { name: "Package Managers", hint: "A tool used to install software packages.", color: "#d8c09a", words: ["npm", "pip", "Homebrew", "apt"] },
        { name: "Build Tools", hint: "A tool used to build and compile projects.", color: "#c9aa76", words: ["Webpack", "Gradle", "Maven", "Make"] },
        { name: "Debugging Terms", hint: "A term used while debugging code.", color: "#a33a2f", words: ["Breakpoint", "Stack Trace", "Logger", "Profiler"] },
      ]
    }
  ],
  marvelAvengers: [
    {
      title: "Case File: Assemble Protocol",
      groups: [
        { name: "Founding Avengers", hint: "A hero who was part of the original Avengers lineup.", color: "#e8d9b7", words: ["Iron Man", "Thor", "Hulk", "Captain America"] },
        { name: "Infinity War Heroes", hint: "A hero who fought Thanos on Titan or in Wakanda.", color: "#d8c09a", words: ["Doctor Strange", "Star-Lord", "Black Panther", "Scarlet Witch"] },
        { name: "Secret Avengers", hint: "A hero who took on covert missions for the team.", color: "#c9aa76", words: ["Falcon", "Winter Soldier", "War Machine", "Vision"] },
        { name: "New Recruits", hint: "A newer hero who's joined the Avengers' ranks.", color: "#a33a2f", words: ["Ms. Marvel", "Shang-Chi", "Kate Bishop", "Cassie Lang"] },
      ]
    }
  ],
  marvelInfinityStones: [
    {
      title: "Case File: Gauntlet Dossier",
      groups: [
        { name: "Infinity Stones", hint: "One of the six all-powerful gems.", color: "#e8d9b7", words: ["Power Stone", "Reality Stone", "Soul Stone", "Time Stone"] },
        { name: "Infinity War Locations", hint: "A planet or realm central to the hunt for the stones.", color: "#d8c09a", words: ["Wakanda", "Titan", "Vormir", "Knowhere"] },
        { name: "Snap-Related Terms", hint: "A term tied to the aftermath of the snap.", color: "#c9aa76", words: ["The Blip", "Decimation", "Time Heist", "Endgame"] },
        { name: "Black Order Members", hint: "One of Thanos's loyal lieutenants.", color: "#a33a2f", words: ["Ebony Maw", "Cull Obsidian", "Proxima Midnight", "Corvus Glaive"] },
      ]
    }
  ],
  marvelXMen: [
    {
      title: "Case File: Mutant Registry",
      groups: [
        { name: "Original X-Men", hint: "A founding member of Professor X's team.", color: "#e8d9b7", words: ["Cyclops", "Jean Grey", "Beast", "Iceman"] },
        { name: "X-Men Villains", hint: "A recurring foe of the X-Men.", color: "#d8c09a", words: ["Magneto", "Apocalypse", "Mister Sinister", "Sabretooth"] },
        { name: "Mutant Powers", hint: "An ability a mutant might possess.", color: "#c9aa76", words: ["Telepathy", "Telekinesis", "Adamantium Claws", "Optic Blasts"] },
        { name: "X-Men Locations", hint: "A place tied to mutant history.", color: "#a33a2f", words: ["Xavier's School", "Genosha", "The Danger Room", "Krakoa"] },
      ]
    }
  ],
  marvelFantasticFour: [
    {
      title: "Case File: Baxter Building Files",
      groups: [
        { name: "Fantastic Four Members", hint: "A member of Marvel's First Family.", color: "#e8d9b7", words: ["Mister Fantastic", "Invisible Woman", "Human Torch", "The Thing"] },
        { name: "FF Powers", hint: "An ability a Fantastic Four member has.", color: "#d8c09a", words: ["Elasticity", "Invisibility", "Flame Control", "Super Strength"] },
        { name: "FF Villains", hint: "A classic Fantastic Four antagonist.", color: "#c9aa76", words: ["Doctor Doom", "Galactus", "Annihilus", "Mole Man"] },
        { name: "Cosmic Terms", hint: "A term tied to the Fantastic Four's cosmic adventures.", color: "#a33a2f", words: ["Negative Zone", "Silver Surfer", "Kree", "Skrulls"] },
      ]
    }
  ],
  marvelGuardians: [
    {
      title: "Case File: Ravager Ledger",
      groups: [
        { name: "Guardians Members", hint: "A core member of the Guardians of the Galaxy.", color: "#e8d9b7", words: ["Star-Lord", "Gamora", "Drax", "Rocket"] },
        { name: "Guardians Allies", hint: "A close ally of the Guardians.", color: "#d8c09a", words: ["Groot", "Mantis", "Nebula", "Kraglin"] },
        { name: "Cosmic Villains", hint: "A powerful threat the Guardians have faced.", color: "#c9aa76", words: ["Ronan", "Ego", "High Evolutionary", "Thanos"] },
        { name: "Space Terms", hint: "A location or ship tied to the Guardians' journeys.", color: "#a33a2f", words: ["Knowhere", "Xandar", "Orgocorp", "Milano"] },
      ]
    }
  ],
  marvelThor: [
    {
      title: "Case File: Nine Realms Dossier",
      groups: [
        { name: "Asgardian Characters", hint: "A member of Asgardian royalty or its guard.", color: "#e8d9b7", words: ["Thor", "Loki", "Odin", "Heimdall"] },
        { name: "Thor's Allies", hint: "A warrior who's fought alongside Thor.", color: "#d8c09a", words: ["Valkyrie", "Sif", "Volstagg", "Fandral"] },
        { name: "Norse-Inspired Terms", hint: "A term tied to Thor's mythic weapons or bridges.", color: "#c9aa76", words: ["Bifrost", "Mjolnir", "Stormbreaker", "Yggdrasil"] },
        { name: "Realms", hint: "One of the Nine Realms.", color: "#a33a2f", words: ["Asgard", "Jotunheim", "Muspelheim", "Niflheim"] },
      ]
    }
  ],
  marvelWakanda: [
    {
      title: "Case File: Wakandan Archive",
      groups: [
        { name: "Black Panther Characters", hint: "A member of the Wakandan royal family or its inner circle.", color: "#e8d9b7", words: ["T'Challa", "Shuri", "Okoye", "Nakia"] },
        { name: "Wakandan Terms", hint: "A term tied to Wakandan technology or culture.", color: "#d8c09a", words: ["Vibranium", "Kimoyo Beads", "Dora Milaje", "Kinetic Energy"] },
        { name: "Wakandan Rivals", hint: "A figure who has clashed with Wakanda.", color: "#c9aa76", words: ["Killmonger", "Ulysses Klaue", "Namor", "M'Baku"] },
        { name: "Black Panther Locations", hint: "A place tied to Wakanda or Talokan.", color: "#a33a2f", words: ["Wakanda", "Birnin Zana", "Warrior Falls", "Talokan"] },
      ]
    }
  ],
  marvelShieldHydra: [
    {
      title: "Case File: Intelligence Dossier",
      groups: [
        { name: "S.H.I.E.L.D. Agents", hint: "A leading figure within S.H.I.E.L.D.", color: "#e8d9b7", words: ["Nick Fury", "Phil Coulson", "Maria Hill", "Melinda May"] },
        { name: "Hydra Terms", hint: "A name or program tied to Hydra.", color: "#d8c09a", words: ["Red Skull", "Baron Zemo", "Arnim Zola", "Winter Soldier Program"] },
        { name: "Spy Terms", hint: "A term from the world of espionage.", color: "#c9aa76", words: ["Black Widow", "Enhanced Interrogation", "Double Agent", "Sleeper Cell"] },
        { name: "S.H.I.E.L.D. Tech", hint: "A piece of S.H.I.E.L.D. equipment.", color: "#a33a2f", words: ["Helicarrier", "Quinjet", "Life Model Decoy", "Icer"] },
      ]
    }
  ],
  marvelDoctorStrange: [
    {
      title: "Case File: Sanctum Files",
      groups: [
        { name: "Sorcerers", hint: "A practitioner of the mystic arts.", color: "#e8d9b7", words: ["Doctor Strange", "The Ancient One", "Wong", "Mordo"] },
        { name: "Magical Artifacts", hint: "A powerful mystic relic.", color: "#d8c09a", words: ["Eye of Agamotto", "Cloak of Levitation", "Book of Vishanti", "Darkhold"] },
        { name: "Mystic Realms", hint: "A dimension tied to Doctor Strange's adventures.", color: "#c9aa76", words: ["Dark Dimension", "Mirror Dimension", "Astral Plane", "Kamar-Taj"] },
        { name: "Magic Villains", hint: "A villain rooted in dark magic.", color: "#a33a2f", words: ["Dormammu", "Nightmare", "Shuma-Gorath", "Baron Mordo"] },
      ]
    }
  ],
  marvelLokiTVA: [
    {
      title: "Case File: Timeline Variance Files",
      groups: [
        { name: "TVA Characters", hint: "An agent or official of the Time Variance Authority.", color: "#e8d9b7", words: ["Mobius", "Ravonna Renslayer", "Hunter B-15", "Casey"] },
        { name: "Multiverse Terms", hint: "A term from the Sacred Timeline's rulebook.", color: "#d8c09a", words: ["Sacred Timeline", "Nexus Event", "Variant", "Pruning"] },
        { name: "Loki Variants", hint: "An alternate version of Loki.", color: "#c9aa76", words: ["President Loki", "Boastful Loki", "Classic Loki", "Kid Loki"] },
        { name: "Time Terms", hint: "A device or force tied to the TVA.", color: "#a33a2f", words: ["TemPad", "Time-Keepers", "He Who Remains", "Alioth"] },
      ]
    }
  ],
  marvelStreetLevel: [
    {
      title: "Case File: Kitchen Dossier",
      groups: [
        { name: "Hell's Kitchen Heroes", hint: "A street-level hero protecting New York's neighborhoods.", color: "#e8d9b7", words: ["Daredevil", "Jessica Jones", "Luke Cage", "Iron Fist"] },
        { name: "Street Villains", hint: "A crime boss or enforcer these heroes face.", color: "#d8c09a", words: ["Kingpin", "Kilgrave", "Bullseye", "Cottonmouth"] },
        { name: "Defenders Terms", hint: "A concept tied to street-level heroes' abilities or foes.", color: "#c9aa76", words: ["The Hand", "Chi", "Radar Sense", "Unbreakable Skin"] },
        { name: "NYC Neighborhoods", hint: "A New York City neighborhood in Marvel stories.", color: "#a33a2f", words: ["Hell's Kitchen", "Harlem", "Chinatown", "Midtown"] },
      ]
    }
  ],
  marvelCaptainAmerica: [
    {
      title: "Case File: Star-Spangled Files",
      groups: [
        { name: "Captain America Allies", hint: "Someone who's fought alongside Steve Rogers or Sam Wilson.", color: "#e8d9b7", words: ["Bucky Barnes", "Sam Wilson", "Sharon Carter", "Peggy Carter"] },
        { name: "Super Soldier Terms", hint: "A term tied to becoming a super soldier.", color: "#d8c09a", words: ["Super Soldier Serum", "Vita-Rays", "Vibranium Shield", "Stars and Stripes"] },
        { name: "Cap Villains", hint: "A recurring foe of Captain America.", color: "#c9aa76", words: ["Red Skull", "Crossbones", "Baron Zemo", "Taskmaster"] },
        { name: "WWII Terms", hint: "A term tied to Cap's origins in the Second World War.", color: "#a33a2f", words: ["Howling Commandos", "Project Rebirth", "Hydra", "Strategic Scientific Reserve"] },
      ]
    }
  ],
  marvelIronMan: [
    {
      title: "Case File: Stark Ledger",
      groups: [
        { name: "Iron Man Suits", hint: "The name of a specific Iron Man armor.", color: "#e8d9b7", words: ["Mark 42", "War Machine Armor", "Hulkbuster", "Bleeding Edge"] },
        { name: "Stark Industries Terms", hint: "A piece of Stark tech.", color: "#d8c09a", words: ["Arc Reactor", "JARVIS", "FRIDAY", "Repulsor"] },
        { name: "Iron Man Allies", hint: "Someone close to Tony Stark.", color: "#c9aa76", words: ["Pepper Potts", "Happy Hogan", "Rhodey", "Peter Parker"] },
        { name: "Iron Man Villains", hint: "A businessman-turned-villain Tony has faced.", color: "#a33a2f", words: ["Obadiah Stane", "Justin Hammer", "Aldrich Killian", "Ivan Vanko"] },
      ]
    }
  ],
  marvelHulk: [
    {
      title: "Case File: Gamma Files",
      groups: [
        { name: "Gamma-Powered Characters", hint: "A character transformed by gamma radiation.", color: "#e8d9b7", words: ["Hulk", "Abomination", "She-Hulk", "Red Hulk"] },
        { name: "Hulk Terms", hint: "A concept tied to Bruce Banner's transformation.", color: "#d8c09a", words: ["Gamma Radiation", "Banner Rage", "World Breaker", "Green Door"] },
        { name: "Hulk Allies", hint: "Someone close to Bruce Banner.", color: "#c9aa76", words: ["Betty Ross", "Rick Jones", "Doc Samson", "Amadeus Cho"] },
        { name: "Hulk Villains", hint: "A foe the Hulk has battled.", color: "#a33a2f", words: ["The Leader", "Zzzax", "Maestro", "U-Foes"] },
      ]
    }
  ],
  marvelAntMan: [
    {
      title: "Case File: Pym Particle Files",
      groups: [
        { name: "Ant-Man Wearers", hint: "Someone who's worn the Ant-Man or Wasp suit.", color: "#e8d9b7", words: ["Scott Lang", "Hank Pym", "Hope van Dyne", "Cassie Lang"] },
        { name: "Quantum Realm Terms", hint: "A term tied to the Quantum Realm.", color: "#d8c09a", words: ["Pym Particles", "Quantum Tunnel", "Time Vortex", "Subatomic"] },
        { name: "Ant-Man Villains", hint: "A foe Scott Lang or Hank Pym has faced.", color: "#c9aa76", words: ["Yellowjacket", "Ghost", "MODOK", "Kang the Conqueror"] },
        { name: "Pym Tech", hint: "A piece of Pym-designed technology.", color: "#a33a2f", words: ["Regulator", "Ant-Thony", "Giant-Man Formula", "Wasp Wings"] },
      ]
    }
  ],
  marvelKang: [
    {
      title: "Case File: Conqueror's Dossier",
      groups: [
        { name: "Kang Variants", hint: "An alternate version of the time-traveling conqueror.", color: "#e8d9b7", words: ["Kang the Conqueror", "Immortus", "Rama-Tut", "Iron Lad"] },
        { name: "Multiverse Saga Terms", hint: "A concept tied to the Multiverse Saga.", color: "#d8c09a", words: ["Council of Kangs", "Sacred Timeline", "Convergence", "Nexus Being"] },
        { name: "Young Avengers", hint: "A member of the teenage Young Avengers roster.", color: "#c9aa76", words: ["Kate Bishop", "Cassie Lang", "Kid Loki", "America Chavez"] },
        { name: "TVA Related", hint: "A term connected to the Time Variance Authority.", color: "#a33a2f", words: ["Nexus Event", "He Who Remains", "Loom", "Temporal Aura"] },
      ]
    }
  ],
  marvelEternals: [
    {
      title: "Case File: Celestial Archive",
      groups: [
        { name: "Eternals Members", hint: "One of the immortal Eternals sent to Earth.", color: "#e8d9b7", words: ["Sersi", "Ikaris", "Thena", "Ajak"] },
        { name: "Cosmic Entities", hint: "A being of immense cosmic power.", color: "#d8c09a", words: ["Celestials", "Arishem", "Eternity", "The Living Tribunal"] },
        { name: "Eternals Terms", hint: "A concept tied to the Eternals' true purpose.", color: "#c9aa76", words: ["Uni-Mind", "Deviants", "Emergence", "Prime Eternal"] },
        { name: "Cosmic Villains", hint: "A threat on a cosmic, world-ending scale.", color: "#a33a2f", words: ["Kro", "Dweller-in-Darkness", "Annihilus", "Galactus"] },
      ]
    }
  ],
  marvelRunaways: [
    {
      title: "Case File: Hideout Files",
      groups: [
        { name: "Runaways Members", hint: "A teen who discovered their parents were secretly villains.", color: "#e8d9b7", words: ["Nico Minoru", "Karolina Dean", "Chase Stein", "Molly Hayes"] },
        { name: "Young Hero Groups", hint: "A team made up of young Marvel heroes.", color: "#d8c09a", words: ["Runaways", "Young Avengers", "Champions", "New Warriors"] },
        { name: "Runaways Powers", hint: "An ability used by a member of the Runaways.", color: "#c9aa76", words: ["Staff of One", "Light Manipulation", "Super Strength", "Dinosaur Companion"] },
        { name: "Runaways Antagonists", hint: "A villainous force the Runaways rebelled against.", color: "#a33a2f", words: ["Pride", "Morgan le Fay", "Wilder Family", "Gibborim"] },
      ]
    }
  ],
  marvelMoonKnight: [
    {
      title: "Case File: Midnight Dossier",
      groups: [
        { name: "Moon Knight Identities", hint: "One of Marc Spector's alternate personas.", color: "#e8d9b7", words: ["Marc Spector", "Steven Grant", "Jake Lockley", "Mr. Knight"] },
        { name: "Egyptian Gods", hint: "A deity tied to Moon Knight's mythology.", color: "#d8c09a", words: ["Khonshu", "Ammit", "Taweret", "Horus"] },
        { name: "Moon Knight Terms", hint: "A concept tied to Moon Knight's powers or lore.", color: "#c9aa76", words: ["Fist of Khonshu", "Avatar", "Duat", "Ushabti"] },
        { name: "Midnight Suns Heroes", hint: "A hero who's teamed up against supernatural threats.", color: "#a33a2f", words: ["Blade", "Magik", "Nico Minoru", "Ghost Rider"] },
      ]
    }
  ],

  marvelWolverine: [
    {
      title: "Case File: Weapon X Dossier",
      groups: [
        { name: "Wolverine Aliases", hint: "A name Logan has gone by.", color: "#e8d9b7", words: ["Logan", "Weapon X", "Patch", "James Howlett"] },
        { name: "Weapon X Terms", hint: "A concept tied to the program that created Wolverine.", color: "#d8c09a", words: ["Adamantium", "Regeneration", "Berserker Rage", "Program X"] },
        { name: "Wolverine Allies", hint: "A fellow X-Man close to Logan.", color: "#c9aa76", words: ["Professor X", "Jean Grey", "Kitty Pryde", "Rogue"] },
        { name: "Wolverine Villains", hint: "A foe who's clashed with Wolverine.", color: "#a33a2f", words: ["Sabretooth", "Lady Deathstrike", "Omega Red", "Mystique"] },
      ]
    }
  ],
  marvelComicTerms: [
    {
      title: "Case File: Bullpen Archive",
      groups: [
        { name: "Comic Terms", hint: "A term editors use when reshaping continuity.", color: "#e8d9b7", words: ["Retcon", "Canon", "Crossover", "Reboot"] },
        { name: "Marvel Imprints", hint: "A distinct publishing line under the Marvel banner.", color: "#d8c09a", words: ["Marvel Knights", "Ultimate Marvel", "Marvel Max", "Marvel Noir"] },
        { name: "Comic Legends", hint: "A legendary creator behind Marvel's early history.", color: "#c9aa76", words: ["Stan Lee", "Jack Kirby", "Steve Ditko", "Todd McFarlane"] },
        { name: "Comic Publishing Terms", hint: "A term used when discussing a comic's structure or release.", color: "#a33a2f", words: ["Story Arc", "Origin Issue", "Variant Cover", "Limited Series"] },
      ]
    }
  ]
};

const connectionPuzzles = Object.values(connectionSets).flat();
function renderConnections() {
  gameState.connections = createConnectionsState();
  setView(gameShell("connections", "Connections", `
    <div id="connections-root"></div>
  `), () => setupConnections(document.getElementById("connections-root")));
}

function createConnectionsState(puzzleIndex = 0) {
  return {
    puzzleIndex: puzzleIndex,
    order: shuffle(connectionPuzzles[puzzleIndex].groups.flatMap(g => g.words)),
    selected: [],
    solved: [],
    mistakes: 0,
    hintsRevealed: [],
    revealed: false,
    lost: false,
    locked: false,
    scoreSaved: false,
    dealCards: true,
    newSolvedGroup: null
  };
}

 
function setupConnections(root) {
  renderConnectionsBoard(root);
  root.addEventListener("click", (event) => {
    const card = event.target.closest("[data-word]");
    const action = event.target.closest("[data-connections-action]");
    if (action) {
      const name = action.dataset.connectionsAction;
      const state = gameState.connections;
 
      if (name === "shuffle") {
        const previousPositions = captureConnectionPositions(root);
        state.order = shuffle(state.order);
        playSound("click");
        renderConnectionsBoard(root, { animateFrom: previousPositions, mode: "shuffle" });
      }
 
      if (name === "clear") {
        state.selected = [];
        playSound("click");
        renderConnectionsBoard(root);
      }
 
      if (name === "new") {
        const nextIndex = (state.puzzleIndex + 1) % connectionPuzzles.length;
        gameState.connections = createConnectionsState(nextIndex);
        playSound("click");
        renderConnectionsBoard(root);
      }
 
      if (name === "hint") {
        if (state.revealed || state.lost) return;
        const puzzle = connectionPuzzles[state.puzzleIndex];
        const nextGroupIndex = puzzle.groups.findIndex((_, i) =>
          !state.solved.includes(i) && !state.hintsRevealed.includes(i)
        );
        if (nextGroupIndex !== -1) {
          state.hintsRevealed.push(nextGroupIndex);
          playSound("click");
          renderConnectionsBoard(root);
        }
      }
 
      if (name === "reveal") {
        if (state.revealed) return;
        state.revealed = true;
        state.locked = true;
        state.selected = [];
        playSound("click");
        renderConnectionsBoard(root);
      }
 
      return;
    }
 
    if (!card || gameState.connections.locked || gameState.connections.revealed || gameState.connections.lost) return;
    toggleConnectionWord(card.dataset.word, root);
  });
}
 
function renderConnectionsBoard(root, options = {}) {
  const state = gameState.connections;
  const puzzle = connectionPuzzles[state.puzzleIndex];
 
  // ---- Solved groups (earned by correct guesses) ----
  const solvedGroups = state.solved.map((groupIndex) => {
    const group = puzzle.groups[groupIndex];
    const newSolvedClass = state.newSolvedGroup === groupIndex ? " just-solved" : "";
    return `
      <div class="solved-group${newSolvedClass}" style="background: ${group.color}">
        <span class="case-stamp">CASE SOLVED</span>
        <h4>${group.name}</h4>
        <p>${group.words.join(", ")}</p>
      </div>
    `;
  }).join("");
 
  // ---- Reveal-all view: show every group, solved or not ----
  // Shown either when the player used "Reveal Answers", or when they've run out of guesses (lost).
  const showAllGroups = state.revealed || state.lost;
  const revealGroups = showAllGroups ? puzzle.groups.map((group, groupIndex) => {
    if (state.solved.includes(groupIndex)) return ""; // already shown above
    return `
      <div class="solved-group revealed-group" style="background: ${group.color}">
        <span class="case-stamp">${state.lost ? "ANSWER" : "REVEALED"}</span>
        <h4>${group.name}</h4>
        <p>${group.words.join(", ")}</p>
      </div>
    `;
  }).join("") : "";
 
  // ---- Remaining cards (hidden entirely once revealed or lost) ----
  const remainingCards = showAllGroups ? "" : state.order
    .filter((word) => !isConnectionSolved(word))
    .map((word, index) => {
      const selected = state.selected.includes(word) ? " selected" : "";
      const deal = state.dealCards ? " deal-card" : "";
      return `<button class="connection-card${selected}${deal}" type="button" data-word="${escapeHtml(word)}" style="--card-index: ${index}">${escapeHtml(word)}</button>`;
    }).join("");
 
  // ---- Hints panel: show hint text for any group whose hint has been revealed but isn't solved yet ----
  const activeHints = state.hintsRevealed
    .filter((groupIndex) => !state.solved.includes(groupIndex))
    .map((groupIndex) => puzzle.groups[groupIndex]);
 
  const hintsPanel = activeHints.length && !state.lost ? `
    <div class="hints-panel">
      ${activeHints.map((group) => `
        <div class="hint-pill" style="border-left: 6px solid ${group.color}">
          <strong>Hint:</strong> ${escapeHtml(group.hint)}
        </div>
      `).join("")}
    </div>
  ` : "";
 
  const dots = Array.from({ length: 4 }, (_, index) => (
    `<span class="mistake-dot ${index < state.mistakes ? "used" : ""}" aria-hidden="true"></span>`
  )).join("");
 
  const hintsLeft = 4 - state.hintsRevealed.length;
  const hintDisabled = state.revealed || state.lost || hintsLeft <= 0 || state.solved.length === 4;
 
  const won = state.solved.length === 4 && !state.revealed;
  if (won && !state.scoreSaved) {
    const score = Math.max(0, 100 - state.mistakes * 15);
    save.highScores.connections = Math.max(save.highScores.connections || 0, score);
    state.scoreSaved = true;
    persistSave();
    playSound("victory");
  }
 
  // ---- Loss: mistakes hit the cap before the puzzle was fully solved ----
  if (state.lost && !state.scoreSaved) {
    state.scoreSaved = true; // no score for a loss, but mark so we don't re-trigger anything
    persistSave();
    playSound("error");
  }
 
  root.innerHTML = `
    <div class="game-topline">
      <div>
        <h3>${puzzle.title}</h3>
        <p class="notice">Select four connected cards.</p>
      </div>
      <div class="status-strip">
        <span class="pill">Wrong <span class="mistake-dots">${dots}</span></span>
        <button class="btn small" type="button" data-connections-action="shuffle" ${state.revealed || state.lost ? "disabled" : ""}>Shuffle</button>
        <button class="btn small" type="button" data-connections-action="clear" ${state.revealed || state.lost ? "disabled" : ""}>Clear</button>
        <button class="btn small" type="button" data-connections-action="hint" ${hintDisabled ? "disabled" : ""}>Hint (${Math.max(0, hintsLeft)} left)</button>
        <button class="btn small danger" type="button" data-connections-action="reveal" ${state.revealed || state.lost ? "disabled" : ""}>Reveal Answers</button>
        <button class="btn small primary" type="button" data-connections-action="new">New Puzzle</button>
      </div>
    </div>
    ${hintsPanel}
    <div class="solved-groups">${solvedGroups}${revealGroups}</div>
    <div class="connections-board ${options.mode === "shuffle" ? "shuffle-cards" : ""}">${remainingCards}</div>
    ${won ? `
      <div class="win-overlay">
        <div class="win-box">
          <h3>Connections Complete</h3>
          <p>Score ${Math.max(0, 100 - state.mistakes * 15)}</p>
          <button class="btn primary" type="button" data-connections-action="new">Next Puzzle</button>
        </div>
      </div>
    ` : ""}
    ${state.lost ? `
      <div class="win-overlay">
        <div class="win-box">
          <h3>Out of Guesses</h3>
          <p>The case file remains unsolved. No score saved.</p>
          <button class="btn primary" type="button" data-connections-action="new">Try Next Puzzle</button>
        </div>
      </div>
    ` : ""}
    ${state.revealed ? `
      <div class="reveal-banner">
        <span><strong>Answers Revealed</strong> — no score is saved for this puzzle.</span>
        <button class="btn small primary" type="button" data-connections-action="new">Next Puzzle</button>
      </div>
    ` : ""}
  `;
 
  if (options.animateFrom) {
    animateConnectionReflow(root, options.animateFrom);
  }
  state.newSolvedGroup = null;
  state.dealCards = false;
}
 
function captureConnectionPositions(root) {
  const positions = new Map();
  if (!root || typeof root.querySelectorAll !== "function") return positions;
  root.querySelectorAll(".connection-card[data-word]").forEach((card) => {
    if (typeof card.getBoundingClientRect !== "function") return;
    positions.set(card.dataset.word, card.getBoundingClientRect());
  });
  return positions;
}
 
function animateConnectionReflow(root, previousPositions) {
  if (!previousPositions || !previousPositions.size) return;
  const cards = root.querySelectorAll(".connection-card[data-word]");
  cards.forEach((card) => {
    const previous = previousPositions.get(card.dataset.word);
    if (!previous || typeof card.getBoundingClientRect !== "function") {
      card.classList.add("card-enter");
      return;
    }
    const next = card.getBoundingClientRect();
    const deltaX = previous.left - next.left;
    const deltaY = previous.top - next.top;
    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;
 
    card.classList.add("rearranging");
    card.style.transition = "none";
    card.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.98)`;
    card.style.zIndex = "3";
 
    requestAnimationFrame(() => {
      card.style.transition = "transform 520ms cubic-bezier(0.2, 0.85, 0.2, 1), box-shadow 220ms ease";
      card.style.transform = "";
    });
 
    setTimeout(() => {
      card.classList.remove("rearranging");
      card.style.transition = "";
      card.style.zIndex = "";
    }, 560);
  });
}
 
function isConnectionSolved(word) {
  const state = gameState.connections;
  const puzzle = connectionPuzzles[state.puzzleIndex];
  const groupIndex = puzzle.groups.findIndex((group) => group.words.includes(word));
  return state.solved.includes(groupIndex);
}
 
function toggleConnectionWord(word, root) {
  const state = gameState.connections;
  const existing = state.selected.indexOf(word);
  if (existing >= 0) {
    state.selected.splice(existing, 1);
    playSound("click");
    renderConnectionsBoard(root);
    return;
  }
  if (state.selected.length >= 4) return;
  state.selected.push(word);
  playSound("click");
  renderConnectionsBoard(root);
  if (state.selected.length === 4) {
    state.locked = true;
    setTimeout(() => evaluateConnectionSelection(root), 260);
  }
}
 
function evaluateConnectionSelection(root) {
  const state = gameState.connections;
  const puzzle = connectionPuzzles[state.puzzleIndex];
  const groupIndexes = state.selected.map((word) => (
    puzzle.groups.findIndex((group) => group.words.includes(word))
  ));
  const first = groupIndexes[0];
  const correct = groupIndexes.every((index) => index === first) && !state.solved.includes(first);
  if (correct) {
    const previousPositions = captureConnectionPositions(root);
    state.solved.push(first);
    state.newSolvedGroup = first;
    state.selected = [];
    state.locked = false;
    playSound("web");
    renderConnectionsBoard(root, { animateFrom: previousPositions, mode: "solve" });
    return;
  }
 
  state.mistakes += 1;
  playSound("error");
  root.querySelectorAll(".connection-card.selected").forEach((card) => card.classList.add("shake"));
  setTimeout(() => {
    state.selected = [];
    state.locked = false;
    if (state.mistakes >= 4) {
      state.lost = true;
      state.locked = true;
    }
    renderConnectionsBoard(root);
  }, 360);
}
const imageDatabase = [
  {
    real: "assets/images/real/realcivilwarspidey.jpg",
    ai: "assets/images/ai/Aicivilwarspidey.png"
  },
  {
    real: "assets/images/real/realavengers.jpg",
    ai: "assets/images/ai/aiavengers.png"
  },
  {
    real: "assets/images/real/realspideyposter.jpg",
    ai: "assets/images/ai/Aispideyposter.png"
  },
  {
    real: "assets/images/real/realnowayhome.jpg",
    ai: "assets/images/ai/Ainowayhome.png"
  },
  {
    real: "assets/images/real/realcomic.jpg",
    ai: "assets/images/ai/aicomic.png"
  },
  {
    real: "assets/images/real/realtony.jpg",
    ai: "assets/images/ai/aitony.png"
  },
  {
    real: "assets/images/real/realhuddle.jpg",
    ai: "assets/images/ai/aihuddle.jpg"
  },
  {
    real: "assets/images/real/realsp.jpg",
    ai: "assets/images/ai/aisp.jpg"
  },
  {
    real: "assets/images/real/realspidernoir.jpg",
    ai: "assets/images/ai/aispidernoir.png"
  },
  {
    real: "assets/images/real/realeyes.jpg",
    ai: "assets/images/ai/aieyes.png"
  },
  {
    real: "assets/images/real/realindian.jpg",
    ai: "assets/images/ai/aiindian.jpg"
  }
];

const imageCache = new Map();

function preloadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const img = new Image();
  img.src = src;
  img.decoding = "async";
  imageCache.set(src, img);
  return img;
}

function preloadNextRounds(state) {
  for (let i = state.round + 1; i < Math.min(state.round + 3, state.rounds.length); i++) {
    const round = state.rounds[i];
    if (round) {
      round.images.forEach(preloadImage);
    }
  }
}

function preloadAllImages() {
  imageDatabase.forEach(pair => {
    preloadImage(pair.real);
    preloadImage(pair.ai);
  });
}

const AI_ROUND_TIME = 20;

function buildAiRounds() {
  return shuffle(imageDatabase).map((pair) => {
    const mixed = shuffle([
      { src: pair.real, kind: "real" },
      { src: pair.ai, kind: "ai" }
    ]);
    return {
      images: mixed.map((item) => item.src),
      correct: mixed.findIndex((item) => item.kind === "ai")
    };
  });
}

function createAiPictureState() {
  return {
    rounds: buildAiRounds(),
    round: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    roundsPlayed: 0,
    timeLeft: AI_ROUND_TIME,
    selected: null,
    timer: null,
    advanceTimer: null, // NEW
    finished: false
  };
}

function renderAiPicture() {
  gameState.aiPicture = createAiPictureState();
  setView(gameShell("ai-picture", "Choose the AI Picture", `
    <div id="ai-picture-root"></div>
  `), () => setupAiPicture(document.getElementById("ai-picture-root")));
}

function renderAiPictureGame(root) {
  const state = gameState.aiPicture;
  if (state.finished) {
    root.innerHTML = `
      <div class="win-box">
        <h3>Round Set Complete</h3>
        <p>Score ${state.score}/${state.roundsPlayed}. Best streak ${state.bestStreak}.</p>
        <button class="btn primary" type="button" data-ai-action="restart">Restart Rounds</button>
      </div>
    `;
    return;
  }
  const round = state.rounds[state.round];
  const percent = Math.max(0, (state.timeLeft / AI_ROUND_TIME) * 100);
  const revealed = state.selected !== null;
  const isCorrect = revealed && state.selected === round.correct;
  const isTimeout = revealed && state.selected === -1;
  const choices = round.images.map((src, index) => {
    const correct = revealed && index === round.correct ? " correct-choice" : "";
    const wrong = revealed && state.selected === index && index !== round.correct ? " wrong-choice shake" : "";
    const selected = revealed && state.selected === index ? " selected-choice" : "";
    return `
      <button class="ai-choice${correct}${wrong}${selected}" type="button" data-ai-choice="${index}" ${revealed ? "disabled" : ""}>
        <img src="${src}" alt="Choice ${index + 1}" loading="eager" decoding="async">
        <span>${String.fromCharCode(65 + index)}</span>
        <i class="iron-leg leg-1" aria-hidden="true"></i>
        <i class="iron-leg leg-2" aria-hidden="true"></i>
        <i class="iron-leg leg-3" aria-hidden="true"></i>
        <i class="iron-leg leg-4" aria-hidden="true"></i>
      </button>
    `;
  }).join("");

  let popup = "";
  if (revealed) {
    const popupClass = isTimeout ? "result-popup timeout" : isCorrect ? "result-popup correct" : "result-popup wrong";
    const icon = isTimeout ? "&#9203;" : isCorrect ? "&#10003;" : "&#10007;";
    const title = isTimeout ? "Time's Up!" : isCorrect ? "Correct!" : "Wrong!";
    const msg = isTimeout
      ? `Correct choice was ${String.fromCharCode(65 + round.correct)}.`
      : isCorrect
        ? "Nice eye. You spotted the AI."
        : `Correct choice was ${String.fromCharCode(65 + round.correct)}.`;
    popup = `
      <div class="${popupClass}">
        <div class="result-popup-box">
          <span class="result-icon">${icon}</span>
          <h3>${title}</h3>
          <p>${msg}</p>
        </div>
      </div>
    `;
  }

  root.innerHTML = `
    <div class="ai-layout">
      <div class="game-topline">
        <div>
          <h3>Find the generated image</h3>
          <p class="notice">${revealed ? "" : "Trust the scan. Pick the AI image."}</p>
        </div>
        <div class="status-strip">
          <span class="pill">Score ${state.score}</span>
          <span class="pill">Streak ${state.streak}</span>
          <span class="pill">Best ${save.highScores["ai-picture"] || 0}</span>
          <span class="pill">Played ${state.roundsPlayed}</span>
          <span class="pill time-pill">Time ${state.timeLeft}s</span>
        </div>
      </div>
      <div class="timer-bar" aria-hidden="true"><div class="timer-fill" style="--time-width: ${percent}%"></div></div>
      <div class="ai-grid">${choices}</div>
      ${popup}
    </div>
  `;
}

function resultAiText(state, round) {
  if (state.selected === -1) return `Time ran out. Correct choice was ${String.fromCharCode(65 + round.correct)}.`;
  if (state.selected === round.correct) return "Correct. Nice eye.";
  return `Not this time. Correct choice was ${String.fromCharCode(65 + round.correct)}.`;
}

function setupAiPicture(root) {
  preloadAllImages();
  renderAiPictureGame(root);
  preloadNextRounds(gameState.aiPicture);
  startAiTimer(root);
  root.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-ai-choice]");
    const action = event.target.closest("[data-ai-action]");
    if (choice) {
      selectAiPicture(Number(choice.dataset.aiChoice), root);
      return;
    }
    if (!action) return;
    const name = action.dataset.aiAction;
    if (name === "next") nextAiRound(root);
    if (name === "restart") {
      clearInterval(gameState.aiPicture.timer);
      clearTimeout(gameState.aiPicture.advanceTimer); // NEW
      gameState.aiPicture = createAiPictureState();
      playSound("click");
      renderAiPictureGame(root);
      startAiTimer(root);
    }
  });
  return () => {
    clearInterval(gameState.aiPicture?.timer);
    clearTimeout(gameState.aiPicture?.advanceTimer); // NEW
  };
}

function startAiTimer(root) {
  const state = gameState.aiPicture;
  clearInterval(state.timer);
  state.timer = setInterval(() => {
    if (state.selected !== null || state.finished) return;
    state.timeLeft -= 1;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      state.selected = -1;
      state.streak = 0;
      state.roundsPlayed += 1;
      playSound("error");
      clearInterval(state.timer);
      renderAiPictureGame(root);
      scheduleAutoAdvance(root);
      return;
    }
    const timerFill = root.querySelector(".timer-fill");
    const timePill = root.querySelector(".time-pill");
    if (timerFill) {
      const percent = Math.max(0, (state.timeLeft / AI_ROUND_TIME) * 100);
      timerFill.style.setProperty("--time-width", percent + "%");
    }
    if (timePill) {
      timePill.textContent = "Time " + state.timeLeft + "s";
    }
  }, 1000);
}

// NEW helper
function scheduleAutoAdvance(root) {
  const state = gameState.aiPicture;
  clearTimeout(state.advanceTimer);
  state.advanceTimer = setTimeout(() => {
    if (state.finished) return;
    nextAiRound(root);
  }, 2500);
}

function selectAiPicture(index, root) {
  const state = gameState.aiPicture;
  if (state.selected !== null || state.finished) return;
  const round = state.rounds[state.round];
  state.selected = index;
  state.roundsPlayed += 1;
  clearInterval(state.timer);
  if (index === round.correct) {
    state.score += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    save.highScores["ai-picture"] = Math.max(save.highScores["ai-picture"] || 0, state.score);
    persistSave();
    playSound("victory");
  } else {
    state.streak = 0;
    playSound("error");
  }
  renderAiPictureGame(root);
  scheduleAutoAdvance(root); // NEW
}

function nextAiRound(root) {
  const state = gameState.aiPicture;
  clearTimeout(state.advanceTimer); // NEW — prevents double-advance if button is clicked early
  if (state.selected === null) return;
  playSound("click");
  state.round += 1;
  if (state.round >= state.rounds.length) {
    state.finished = true;
    renderAiPictureGame(root);
    return;
  }
  state.selected = null;
  state.timeLeft = AI_ROUND_TIME;
  renderAiPictureGame(root);
  preloadNextRounds(state);
  startAiTimer(root);
}
 
document.addEventListener("mousemove", (event) => {
  const x = (event.clientX / window.innerWidth - 0.5) * 18;
  const y = (event.clientY / window.innerHeight - 0.5) * 18;
  document.body.style.setProperty("--px", x.toFixed(2));
  document.body.style.setProperty("--py", y.toFixed(2));
  document.body.style.setProperty("--mx", `${event.clientX}px`);
  document.body.style.setProperty("--my", `${event.clientY}px`);
});

window.addEventListener("hashchange", renderRoute);
syncTheme();
renderRoute();
