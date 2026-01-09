#!/usr/bin/env python3
"""
SPM Server Manager GUI
Aplicacion para monitorear, iniciar, reiniciar y detener los servidores Backend y Frontend.
"""

import os
import socket
import subprocess
import sys
import threading
import webbrowser
from datetime import datetime
from pathlib import Path
from queue import Empty, Queue

# Tkinter imports
import tkinter as tk
from tkinter import messagebox, scrolledtext, ttk

# Intentar importar urllib para health check (built-in)
try:
    from urllib.request import urlopen
    from urllib.error import URLError
    URLLIB_AVAILABLE = True
except ImportError:
    URLLIB_AVAILABLE = False

# Intentar importar pystray para system tray (opcional)
try:
    import pystray
    from PIL import Image, ImageDraw
    TRAY_AVAILABLE = True
except ImportError:
    TRAY_AVAILABLE = False

# ============================================================================
# Configuracion
# ============================================================================

# Detectar directorio del proyecto
SCRIPT_DIR = Path(__file__).parent.absolute()
PROJECT_ROOT = SCRIPT_DIR.parent

SERVERS = {
    "backend": {
        "name": "Backend (Flask)",
        "port": 5000,
        "cmd": [sys.executable, "wsgi.py"],
        "cwd": str(PROJECT_ROOT),
        "health_url": "http://localhost:5000/api/health",
    },
    "frontend": {
        "name": "Frontend (Vite)",
        "port": 5173,
        "cmd": ["npm", "run", "dev"],
        "cwd": str(PROJECT_ROOT / "frontend"),
        "health_url": None,  # Solo verificamos puerto
    },
}

HEALTH_CHECK_INTERVAL = 5000  # ms
LOG_MAX_LINES = 500


# ============================================================================
# Clase ServerProcess - Gestiona un proceso de servidor
# ============================================================================

class ServerProcess:
    """Gestiona un proceso de servidor individual."""

    def __init__(self, name: str, config: dict, log_callback):
        self.name = name
        self.config = config
        self.log_callback = log_callback
        self.process = None
        self.output_queue = Queue()
        self.reader_thread = None
        self._stop_reading = False

    def start(self) -> bool:
        """Inicia el servidor."""
        if self.is_running():
            self.log_callback(f"{self.name} ya esta corriendo")
            return False

        # Verificar si el puerto esta ocupado por otro proceso
        if self._is_port_in_use():
            self.log_callback(f"Puerto {self.config['port']} ya esta en uso")
            return False

        try:
            # Crear proceso
            creation_flags = 0
            if sys.platform == "win32":
                creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP

            self.process = subprocess.Popen(
                self.config["cmd"],
                cwd=self.config["cwd"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                creationflags=creation_flags,
            )

            # Iniciar thread para leer output
            self._stop_reading = False
            self.reader_thread = threading.Thread(
                target=self._read_output, daemon=True
            )
            self.reader_thread.start()

            self.log_callback(f"{self.name} iniciado (PID: {self.process.pid})")
            return True

        except Exception as e:
            self.log_callback(f"Error iniciando {self.name}: {e}")
            return False

    def stop(self) -> bool:
        """Detiene el servidor."""
        if not self.process:
            return True

        self._stop_reading = True

        try:
            if sys.platform == "win32":
                # En Windows, terminar arbol de procesos
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(self.process.pid)],
                    capture_output=True,
                )
            else:
                self.process.terminate()
                self.process.wait(timeout=5)
        except Exception as e:
            self.log_callback(f"Error deteniendo {self.name}: {e}")
            try:
                self.process.kill()
            except Exception:
                pass

        self.process = None
        self.log_callback(f"{self.name} detenido")
        return True

    def restart(self) -> bool:
        """Reinicia el servidor."""
        self.log_callback(f"Reiniciando {self.name}...")
        self.stop()
        # Esperar un poco antes de reiniciar
        import time
        time.sleep(1)
        return self.start()

    def is_running(self) -> bool:
        """Verifica si el proceso esta corriendo."""
        if self.process is None:
            return False
        return self.process.poll() is None

    def get_pid(self) -> int | None:
        """Obtiene el PID del proceso."""
        if self.process and self.is_running():
            return self.process.pid
        return None

    def _is_port_in_use(self) -> bool:
        """Verifica si el puerto esta en uso."""
        port = self.config["port"]
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(("localhost", port)) == 0

    def _read_output(self):
        """Lee la salida del proceso en un thread separado."""
        try:
            while not self._stop_reading and self.process:
                line = self.process.stdout.readline()
                if line:
                    self.output_queue.put(line.strip())
                elif self.process.poll() is not None:
                    break
        except Exception:
            pass

    def get_pending_output(self) -> list:
        """Obtiene todas las lineas pendientes de output."""
        lines = []
        while True:
            try:
                lines.append(self.output_queue.get_nowait())
            except Empty:
                break
        return lines


# ============================================================================
# Clase SPMManagerApp - Aplicacion principal
# ============================================================================

class SPMManagerApp(tk.Tk):
    """Aplicacion principal del SPM Server Manager."""

    def __init__(self):
        super().__init__()

        self.title("SPM Server Manager")
        self.geometry("800x600")
        self.minsize(700, 500)

        # Icono de la ventana (si existe)
        try:
            icon_path = PROJECT_ROOT / "frontend" / "public" / "favicon.ico"
            if icon_path.exists():
                self.iconbitmap(str(icon_path))
        except Exception:
            pass

        # Variables
        self.servers = {}
        self.status_labels = {}
        self.pid_labels = {}
        self.tray_icon = None

        # Crear servidores
        for key, config in SERVERS.items():
            self.servers[key] = ServerProcess(
                config["name"], config, lambda msg, k=key: self._log(k, msg)
            )

        # Construir UI
        self._setup_ui()

        # Iniciar health check periodico
        self._schedule_health_check()

        # Iniciar lectura de logs
        self._schedule_log_update()

        # Detectar servidores ya corriendo
        self._detect_running_servers()

        # Configurar cierre de ventana
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    def _setup_ui(self):
        """Construye la interfaz de usuario."""
        # Frame principal con padding
        main_frame = ttk.Frame(self, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # === Seccion de servidores ===
        servers_frame = ttk.LabelFrame(main_frame, text="Servidores", padding="10")
        servers_frame.pack(fill=tk.X, pady=(0, 10))

        # Crear panel para cada servidor
        for i, (key, config) in enumerate(SERVERS.items()):
            self._create_server_panel(servers_frame, key, config, i)

        # === Botones globales ===
        actions_frame = ttk.Frame(main_frame)
        actions_frame.pack(fill=tk.X, pady=(0, 10))

        ttk.Button(
            actions_frame, text="Start All", command=self._start_all
        ).pack(side=tk.LEFT, padx=2)

        ttk.Button(
            actions_frame, text="Stop All", command=self._stop_all
        ).pack(side=tk.LEFT, padx=2)

        ttk.Button(
            actions_frame, text="Restart All", command=self._restart_all
        ).pack(side=tk.LEFT, padx=2)

        ttk.Separator(actions_frame, orient=tk.VERTICAL).pack(
            side=tk.LEFT, fill=tk.Y, padx=10
        )

        ttk.Button(
            actions_frame, text="Abrir Navegador", command=self._open_browser
        ).pack(side=tk.LEFT, padx=2)

        if TRAY_AVAILABLE:
            ttk.Button(
                actions_frame, text="Minimizar a Tray", command=self._minimize_to_tray
            ).pack(side=tk.LEFT, padx=2)

        # Health status
        self.health_label = ttk.Label(actions_frame, text="Health: --")
        self.health_label.pack(side=tk.RIGHT, padx=10)

        # === Panel de logs ===
        logs_frame = ttk.LabelFrame(main_frame, text="Logs", padding="5")
        logs_frame.pack(fill=tk.BOTH, expand=True)

        # Notebook con tabs
        self.log_notebook = ttk.Notebook(logs_frame)
        self.log_notebook.pack(fill=tk.BOTH, expand=True)

        self.log_texts = {}
        for key, config in SERVERS.items():
            frame = ttk.Frame(self.log_notebook)
            self.log_notebook.add(frame, text=config["name"])

            log_text = scrolledtext.ScrolledText(
                frame, wrap=tk.WORD, height=15, font=("Consolas", 9)
            )
            log_text.pack(fill=tk.BOTH, expand=True)
            log_text.configure(state=tk.DISABLED)
            self.log_texts[key] = log_text

        # Boton para limpiar logs
        clear_frame = ttk.Frame(logs_frame)
        clear_frame.pack(fill=tk.X, pady=(5, 0))
        ttk.Button(
            clear_frame, text="Limpiar Logs", command=self._clear_logs
        ).pack(side=tk.LEFT)

    def _create_server_panel(self, parent, key: str, config: dict, column: int):
        """Crea el panel para un servidor."""
        frame = ttk.Frame(parent, padding="5")
        frame.grid(row=0, column=column, padx=10, sticky="nsew")
        parent.columnconfigure(column, weight=1)

        # Nombre y puerto
        ttk.Label(
            frame, text=f"{config['name']}", font=("", 10, "bold")
        ).pack()
        ttk.Label(frame, text=f"Puerto: {config['port']}").pack()

        # Indicador de estado
        status_frame = ttk.Frame(frame)
        status_frame.pack(pady=5)

        canvas = tk.Canvas(status_frame, width=20, height=20, highlightthickness=0)
        canvas.pack(side=tk.LEFT)
        self.status_labels[key] = canvas
        canvas.create_oval(2, 2, 18, 18, fill="gray", outline="")

        self.pid_labels[key] = ttk.Label(status_frame, text="PID: --")
        self.pid_labels[key].pack(side=tk.LEFT, padx=5)

        # Botones
        btn_frame = ttk.Frame(frame)
        btn_frame.pack(pady=5)

        ttk.Button(
            btn_frame, text="Start", width=8,
            command=lambda k=key: self._start_server(k)
        ).pack(side=tk.LEFT, padx=2)

        ttk.Button(
            btn_frame, text="Stop", width=8,
            command=lambda k=key: self._stop_server(k)
        ).pack(side=tk.LEFT, padx=2)

        ttk.Button(
            btn_frame, text="Restart", width=8,
            command=lambda k=key: self._restart_server(k)
        ).pack(side=tk.LEFT, padx=2)

    def _start_server(self, key: str):
        """Inicia un servidor."""
        threading.Thread(
            target=lambda: self.servers[key].start(), daemon=True
        ).start()

    def _stop_server(self, key: str):
        """Detiene un servidor."""
        threading.Thread(
            target=lambda: self.servers[key].stop(), daemon=True
        ).start()

    def _restart_server(self, key: str):
        """Reinicia un servidor."""
        threading.Thread(
            target=lambda: self.servers[key].restart(), daemon=True
        ).start()

    def _start_all(self):
        """Inicia todos los servidores."""
        for key in self.servers:
            self._start_server(key)

    def _stop_all(self):
        """Detiene todos los servidores."""
        for key in self.servers:
            self._stop_server(key)

    def _restart_all(self):
        """Reinicia todos los servidores."""
        for key in self.servers:
            self._restart_server(key)

    def _open_browser(self):
        """Abre el navegador en la aplicacion."""
        webbrowser.open("http://localhost:5173")

    def _log(self, server_key: str, message: str):
        """Agrega un mensaje al log del servidor."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        full_message = f"[{timestamp}] {message}\n"

        # Usar after para thread-safety
        self.after(0, lambda: self._append_log(server_key, full_message))

    def _append_log(self, server_key: str, message: str):
        """Agrega mensaje al widget de log (debe llamarse desde main thread)."""
        if server_key not in self.log_texts:
            return

        log_text = self.log_texts[server_key]
        log_text.configure(state=tk.NORMAL)
        log_text.insert(tk.END, message)

        # Limitar lineas
        lines = int(log_text.index("end-1c").split(".")[0])
        if lines > LOG_MAX_LINES:
            log_text.delete("1.0", f"{lines - LOG_MAX_LINES}.0")

        log_text.see(tk.END)
        log_text.configure(state=tk.DISABLED)

    def _clear_logs(self):
        """Limpia todos los logs."""
        for log_text in self.log_texts.values():
            log_text.configure(state=tk.NORMAL)
            log_text.delete("1.0", tk.END)
            log_text.configure(state=tk.DISABLED)

    def _update_status(self, key: str, running: bool, pid: int | None = None):
        """Actualiza el indicador de estado de un servidor."""
        color = "green" if running else "red"
        canvas = self.status_labels[key]
        canvas.delete("all")
        canvas.create_oval(2, 2, 18, 18, fill=color, outline="")

        pid_text = f"PID: {pid}" if pid else "PID: --"
        self.pid_labels[key].configure(text=pid_text)

    def _schedule_health_check(self):
        """Programa el health check periodico."""
        self._do_health_check()
        self.after(HEALTH_CHECK_INTERVAL, self._schedule_health_check)

    def _do_health_check(self):
        """Realiza el health check."""
        threading.Thread(target=self._health_check_thread, daemon=True).start()

    def _health_check_thread(self):
        """Thread para health check."""
        # Verificar cada servidor
        for key, server in self.servers.items():
            running = server.is_running() or self._check_port(SERVERS[key]["port"])
            pid = server.get_pid()
            self.after(0, lambda k=key, r=running, p=pid: self._update_status(k, r, p))

        # Health check del backend
        if URLLIB_AVAILABLE:
            try:
                start = datetime.now()
                response = urlopen(SERVERS["backend"]["health_url"], timeout=2)
                latency = (datetime.now() - start).total_seconds() * 1000
                if response.status == 200:
                    self.after(
                        0,
                        lambda: self.health_label.configure(
                            text=f"Health: OK ({latency:.0f}ms)"
                        ),
                    )
                else:
                    self.after(
                        0, lambda: self.health_label.configure(text="Health: Error")
                    )
            except Exception:
                self.after(0, lambda: self.health_label.configure(text="Health: --"))
        else:
            # Sin urllib, solo verificar puerto
            if self._check_port(5000):
                self.after(0, lambda: self.health_label.configure(text="Health: OK"))
            else:
                self.after(0, lambda: self.health_label.configure(text="Health: --"))

    def _check_port(self, port: int) -> bool:
        """Verifica si un puerto esta en uso."""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(("localhost", port)) == 0

    def _schedule_log_update(self):
        """Programa la actualizacion de logs."""
        self._update_logs()
        self.after(100, self._schedule_log_update)

    def _update_logs(self):
        """Actualiza los logs desde las colas de output."""
        for key, server in self.servers.items():
            for line in server.get_pending_output():
                self._append_log(key, f"{line}\n")

    def _detect_running_servers(self):
        """Detecta servidores ya corriendo al iniciar."""
        for key, config in SERVERS.items():
            if self._check_port(config["port"]):
                self._log(key, f"Detectado servidor ya corriendo en puerto {config['port']}")
                self._update_status(key, True, None)

    def _minimize_to_tray(self):
        """Minimiza la aplicacion a la bandeja del sistema."""
        if not TRAY_AVAILABLE:
            messagebox.showinfo(
                "No disponible",
                "Instala pystray y pillow para usar esta funcion:\npip install pystray pillow",
            )
            return

        self.withdraw()
        self._create_tray_icon()

    def _create_tray_icon(self):
        """Crea el icono en la bandeja del sistema."""
        # Crear imagen simple para el icono
        image = Image.new("RGB", (64, 64), color=(52, 152, 219))
        draw = ImageDraw.Draw(image)
        draw.ellipse([16, 16, 48, 48], fill=(46, 204, 113))

        menu = pystray.Menu(
            pystray.MenuItem("Mostrar", self._restore_from_tray),
            pystray.MenuItem("Start All", lambda: self.after(0, self._start_all)),
            pystray.MenuItem("Stop All", lambda: self.after(0, self._stop_all)),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Salir", self._quit_from_tray),
        )

        self.tray_icon = pystray.Icon("SPM Manager", image, "SPM Server Manager", menu)
        threading.Thread(target=self.tray_icon.run, daemon=True).start()

    def _restore_from_tray(self):
        """Restaura la ventana desde la bandeja."""
        if self.tray_icon:
            self.tray_icon.stop()
            self.tray_icon = None
        self.after(0, self.deiconify)

    def _quit_from_tray(self):
        """Cierra la aplicacion desde la bandeja."""
        if self.tray_icon:
            self.tray_icon.stop()
        self.after(0, self._quit_app)

    def _on_close(self):
        """Maneja el cierre de la ventana."""
        # Verificar si hay servidores corriendo
        running = any(s.is_running() for s in self.servers.values())
        if running:
            if not messagebox.askyesno(
                "Confirmar salida",
                "Hay servidores corriendo. ¿Deseas detenerlos y salir?",
            ):
                return

        self._quit_app()

    def _quit_app(self):
        """Cierra la aplicacion."""
        # Detener todos los servidores
        for server in self.servers.values():
            server.stop()

        if self.tray_icon:
            self.tray_icon.stop()

        self.quit()
        self.destroy()


# ============================================================================
# Main
# ============================================================================

def main():
    """Punto de entrada principal."""
    app = SPMManagerApp()
    app.mainloop()


if __name__ == "__main__":
    main()
