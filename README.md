# Bel Madrasah Tsanawiyah Negeri 1 Pandeglang
## ✨ Instalasi

```bash
mkdir -p ~/.config/systemd/user
nano ~/.config/systemd/user/bel-madrasah.service
```

```bash
[Unit]
Description=Bel Madrasah Otomatis
After=default.target

[Service]
ExecStart=/usr/bin/python3 /home/zulfikriyahya/bel-madrasah/main.py
Restart=always
Environment=XDG_RUNTIME_DIR=/run/user/1000
Environment=DISPLAY=:0
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable bel-madrasah.service
systemctl --user start bel-madrasah.service
sudo loginctl enable-linger zulfikriyahya
```
