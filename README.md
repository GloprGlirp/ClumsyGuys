# 🫘 Clumsy Guys

Tollpatschiges Multiplayer-Party-Spiel im Browser – inspiriert von Fall Guys. Renn mit bis zu 24 Bohnen durch Hindernisparcours, überlebe wackelige Plattformen und schnapp dir im Finale die Krone.

## Features

- **Echtzeit-Multiplayer** über Socket.IO – private Räume mit 4-stelligem Code / Einladungslink oder „Schnell spielen“ in öffentlichen Räumen
- **Bots** füllen die Runde auf (Host stellt die Anzahl ein) – sie benutzen dieselbe Physik wie du
- **Schubsen & Festhalten** wie bei Fall Guys – Bots schubsen auch zurück 😈
- **Chat** mit Sprechblasen über den Köpfen + Emotes (👋 💃 🎉 😂)
- **Charakter-Anpassung**: Farben (inkl. freier Farbwahl), 7 Muster, 6 Augen-Stile, 10 Hüte, 6 Extras – wird im Browser gespeichert
- **20 Minispiele** – vor jeder Runde entscheidet ein **Glücksrad**, was kommt. In einer Show kommt kein Spiel doppelt.
  - 🏃 **Rennen**: Wackelweg, Kreiselchaos, Hüpfburg, Rutschpartie, Pendelpfad, Blinkbrücke, Kugelberg, Türchaos, Balkenwald, Fließbandfabrik
  - 🛡️ **Überleben**: Schwingscheibe, Springseil, Kugelhagel, Farbfeld, Hammerhalle, Karussell
  - 👑 **Finale** (eigenes Glücksrad): Wabenfall, Schrumpfinsel, Kronenkletterei, Mauersturm
- Ablauf: bis zu 4 Runden, in denen jeweils ein Teil rausfliegt, dann das Finale um die Krone
- Lobby-Spielwiese mit Sprungpads und Bumpern zum Rumalbern vor dem Start
- Touch-Steuerung fürs Handy (Joystick + Buttons)

## Steuerung

| Taste | Aktion |
|---|---|
| WASD / Pfeile | Laufen |
| Leertaste | Springen |
| Shift | Hechtsprung |
| E | Schubsen |
| F (halten) | Festhalten – bremst den anderen und zieht ihn mit |
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
shared/   Physik, Level (maps.js, maps-extra.js, mapkit.js), Looks – läuft auf Server UND im Browser
public/   Three.js-Client (Rendering, Charaktere, HUD, Chat, Menü)
test/     Simulationstest für Physik und Bots
```

Die Spielphysik ist deterministisch und wird geteilt: Dein Browser simuliert deine Bohne selbst (kein Input-Lag), der Server simuliert die Bots mit exakt denselben Regeln. Hindernisse hängen nur von der synchronisierten Rundenzeit und einem Seed ab, deshalb sehen alle Spieler dasselbe.
