(function () {
  var btn = document.getElementById("loginBtn");
  var err = document.getElementById("errMsg");

  function showErr(msg) {
    err.textContent = msg;
    err.style.display = "block";
  }

  async function login() {
    var u = document.getElementById("username").value.trim();
    var p = document.getElementById("password").value;
    if (!u || !p) {
      showErr("Username dan password harus diisi");
      return;
    }
    btn.disabled = true;
    btn.textContent = "Memproses...";
    err.style.display = "none";
    try {
      var res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = "/";
    } catch (e) {
      showErr(e.message);
      btn.disabled = false;
      btn.textContent = "Masuk";
    }
  }

  btn.addEventListener("click", login);
  document.getElementById("password").addEventListener("keydown", function (e) {
    if (e.key === "Enter") login();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }
})();
