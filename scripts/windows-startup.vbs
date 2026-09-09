Set shell = CreateObject("WScript.Shell")
shell.Run "wsl.exe -d Ubuntu -u root -- bash -lc ""/opt/local-ai-chat/scripts/wsl-startup.sh && exec tail -f /dev/null""", 0, False
