(function () {
  var btn = document.getElementById("loginBtn");
  var alert = document.getElementById("loginAlert");

  function showAlert(msg) {
    alert.textContent = msg;
    alert.classList.add("show");
  }

  function hideAlert() {
    alert.classList.remove("show");
  }

  async function login() {
    var u = document.getElementById("username").value.trim();
    var p = document.getElementById("password").value;
    if (!u || !p) {
      showAlert("Username dan password harus diisi.");
      return;
    }
    btn.disabled = true;
    btn.textContent = "Memproses...";
    hideAlert();
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
      showAlert(e.message);
      btn.disabled = false;
      btn.textContent = "Masuk";
    }
  }

  btn.addEventListener("click", login);
  document.getElementById("password").addEventListener("keydown", function (e) {
    if (e.key === "Enter") login();
  });
  document.getElementById("username").addEventListener("keydown", function (e) {
    if (e.key === "Enter") document.getElementById("password").focus();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }
})();
