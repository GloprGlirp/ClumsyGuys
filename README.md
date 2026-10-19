# 🫘 Clumsy Guys

Tollpatschiges Multiplayer-Party-Spiel im Browser – inspiriert von Fall Guys. Renn mit bis zu 24 Bohnen durch Hindernisparcours, überlebe wackelige Plattformen und schnapp dir im Finale die Krone.

## Features

- **Echtzeit-Multiplayer** über Socket.IO – private Räume mit 4-stelligem Code / Einladungslink oder „Schnell spielen“ in öffentlichen Räumen
- **Bots** füllen die Runde auf (Host stellt die Anzahl ein) – sie benutzen dieselbe Physik wie du
- **Chat** mit Sprechblasen über den Köpfen + Emotes (👋 💃 🎉 😂)
- **Charakter-Anpassung**: Farben (inkl. freier Farbwahl), 7 Muster, 6 Augen-Stile, 10 Hüte, 6 Extras – wird im Browser gespeichert
- **4 Level** in einer Show aus mehreren Runden:
  - 🏃 **Wackelweg** (Rennen) – Fake-Türen, Drehbalken, bewegte Plattformen, Pendelhämmer, rollende Kugeln
  - 🌀 **Kreiselchaos** (Rennen) – Fließband mit Bumpern, Drehscheiben, Blinkplatten, Balken-Arena
  - 🪵 **Schwingscheibe** (Überleben) – unteren Balken überspringen, dem oberen ausweichen, Platten fallen weg
  - 🐝 **Wabenfall** (Finale) – drei Ebenen Waben, die beim Betreten zerbröseln. Letzter gewinnt 👑
- Lobby-Spielwiese mit Sprungpads und Bumpern zum Rumalbern vor dem Start
- Touch-Steuerung fürs Handy (Joystick + Buttons)

## Steuerung

| Taste | Aktion |
|---|---|
| WASD / Pfeile | Laufen |
| Leertaste | Springen |
| Shift / E | Hechtsprung |
| Maus (Klick für Maus-Fang) | Kamera |
| Mausrad | Zoom |
| Enter / T | Chat |
| 1–4 | Emotes |
| M | Ton an/aus |

## Lokal starten

```bash
npm install
npm start
# → http://localhost:3000
```

Tests (simuliert Bots auf allen Maps ohne Browser):

```bash
npm test
```

## Hosting auf Render

Das Repo enthält eine `render.yaml`. Auf [render.com](https://render.com) **New → Blueprint** wählen und dieses Repo verbinden – fertig. Alternativ manuell einen *Web Service* anlegen:

- Build Command: `npm install`
- Start Command: `npm start`

Der Server nutzt automatisch die `PORT`-Variable von Render.

## Aufbau

```
server/   Express + Socket.IO, Räume, Rundenablauf, Bot-KI
shared/   Physik, Level-Definitionen, Looks – läuft auf Server UND im Browser
public/   Three.js-Client (Rendering, Charaktere, HUD, Chat, Menü)
test/     Simulationstest für Physik und Bots
```

Die Spielphysik ist deterministisch und wird geteilt: Dein Browser simuliert deine Bohne selbst (kein Input-Lag), der Server simuliert die Bots mit exakt denselben Regeln. Hindernisse hängen nur von der synchronisierten Rundenzeit und einem Seed ab, deshalb sehen alle Spieler dasselbe.
