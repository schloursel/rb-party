# RB-Party als App installieren

In diesem Ordner liegt alles, was die App braucht:

- `index.html` – das Spiel
- `manifest.webmanifest` – Name, Farben und Icons der App
- `sw.js` – sorgt dafür, dass die App auch ohne Internet startet
- `icons/` – App-Symbole

## 1. Auf GitHub Pages hochladen (einmalig)

1. Auf github.com ein Konto anlegen oder einloggen.
2. Oben rechts **+ → New repository**, Namen eingeben (z. B. `rb-party`), **Public** wählen, **Create repository**.
3. Auf der neuen Seite **uploading an existing file** anklicken und den **gesamten Inhalt dieses Ordners** hineinziehen (`index.html`, `manifest.webmanifest`, `sw.js` und den Ordner `icons`). Dann **Commit changes**.
4. Im Repository **Settings → Pages**: Bei *Branch* `main` und `/ (root)` wählen, **Save**.
5. Nach ein bis zwei Minuten steht dort die Adresse, z. B. `https://DEINNAME.github.io/rb-party/`.

## 2. Auf Handy oder Tablet installieren

- **Android (Chrome):** Adresse öffnen, dann oben rechts im Spiel auf das Symbol **⤓** tippen oder im Chrome-Menü **App installieren** wählen.
- **iPhone/iPad (Safari):** Adresse öffnen, unten auf **Teilen** tippen, **Zum Home-Bildschirm** wählen.

Beim ersten Öffnen muss Internet da sein (die Schriften werden dabei gespeichert). Danach läuft die App auch offline.

## 3. Beamer

**Zwei Geräte (Pad auf dem Handy, Beamer auf Tablet/Laptop/TV):**

1. Auf dem Beamer-Gerät die App-Adresse mit `?beamer=1` am Ende öffnen, z. B. `https://DEINNAME.github.io/rb-party/?beamer=1`. Oben links erscheint ein **4-stelliger Code**.
2. Am Pad oben auf das Symbol **🔗** tippen und den Code eintippen. Beim vierten Ziffer verbindet es automatisch, der Beamer zeigt dann „Pad verbunden“.
3. Der Code bleibt beim Neuladen gleich. Ein neuer Code entsteht, wenn du am Beamer auf das Code-Feld tippst.

Beide Geräte brauchen Internet (kostenloser Vermittlungsdienst PeerJS). Im gleichen WLAN klappt es am zuverlässigsten. Fällt die Verbindung kurz weg, verbindet sich das Pad von selbst wieder.

**Ein Gerät:** Das Symbol 🖥️ öffnet den Beamer in einem zweiten Fenster im selben Browser, das ist ohne Code synchron. Auf dem Tablet kannst du dieses Fenster per Bildschirmspiegelung oder HDMI auf den Beamer legen.

## 4. Update einspielen

1. Neue `index.html` im Repository ersetzen (Datei öffnen → Stift-Symbol, oder neu hochladen).
2. In `sw.js` oben die Zeile `const VERSION = 'rbparty-v2.3.53';` auf eine neue Nummer ändern (z. B. `'rbparty-v2.3.54'`), sonst zeigen Geräte noch die alte Version.
3. Die App einmal komplett schließen und neu öffnen.

