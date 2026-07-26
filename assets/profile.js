(function(){
  "use strict";

  var pendingAvatar; // undefined = no change yet; '' = removed; dataURL = new upload

  function fieldError(input, msg){
    input.classList.toggle('field-error', !!msg);
    var errEl = input.parentElement.querySelector('.error-text');
    if (errEl) errEl.textContent = msg || '';
  }

  function paintPreview(user, override){
    var el = document.getElementById('avatarPreview');
    var avatar = override !== undefined ? override : (user ? user.avatar : '');
    if (avatar){
      el.style.backgroundImage = 'url(' + avatar + ')';
      el.textContent = '';
    } else {
      el.style.backgroundImage = 'none';
      el.textContent = user ? window.SolarM.avatarInitial(user) : '?';
    }
  }

  function resizeImage(file, maxDim, cb){
    var reader = new FileReader();
    reader.onload = function(e){
      var img = new Image();
      img.onload = function(){
        var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        cb(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function render(){
    var user = window.SolarM.currentUser();
    var gate = document.getElementById('signinGate');
    var shell = document.getElementById('profileShell');
    pendingAvatar = undefined;

    if (!user){
      gate.style.display = 'block';
      shell.style.display = 'none';
      return;
    }
    gate.style.display = 'none';
    shell.style.display = 'block';

    document.getElementById('pfFirst').value = user.firstName || '';
    document.getElementById('pfLast').value = user.lastName || '';
    document.getElementById('pfEmail').value = user.email || '';
    document.getElementById('pfPhone').value = user.phone || '';
    document.getElementById('pfPassword').value = '';
    paintPreview(user);
  }

  document.getElementById('gateSignIn').addEventListener('click', function(){
    window.SolarM.openAuth('signin');
  });

  document.getElementById('avatarInput').addEventListener('change', function(e){
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    resizeImage(file, 300, function(dataUrl){
      pendingAvatar = dataUrl;
      paintPreview(null, dataUrl);
    });
  });

  document.getElementById('removeAvatarBtn').addEventListener('click', function(){
    pendingAvatar = '';
    paintPreview(null, '');
  });

  document.getElementById('profileForm').addEventListener('submit', function(e){
    e.preventDefault();
    var user = window.SolarM.currentUser();
    if (!user) return;

    var firstEl = document.getElementById('pfFirst');
    var lastEl = document.getElementById('pfLast');
    var emailEl = document.getElementById('pfEmail');
    var phoneEl = document.getElementById('pfPhone');
    var passwordEl = document.getElementById('pfPassword');
    var msg = document.getElementById('pfMsg');
    var valid = true;

    fieldError(firstEl, firstEl.value.trim() ? '' : 'Required');
    fieldError(lastEl, lastEl.value.trim() ? '' : 'Required');
    fieldError(emailEl, /^\S+@\S+\.\S+$/.test(emailEl.value.trim()) ? '' : 'Valid email required');
    [firstEl,lastEl,emailEl].forEach(function(f){ if (f.classList.contains('field-error')) valid = false; });
    if (!valid) return;

    var newEmail = emailEl.value.trim().toLowerCase();
    var users = window.SolarM.getUsers();

    if (newEmail !== user.email && users[newEmail]){
      msg.textContent = 'That email is already in use by another account.';
      msg.className = 'auth-msg err';
      return;
    }

    var updated = {
      firstName: firstEl.value.trim(),
      lastName: lastEl.value.trim(),
      email: newEmail,
      phone: phoneEl.value.trim(),
      password: passwordEl.value ? passwordEl.value : user.password,
      member: user.member,
      avatar: pendingAvatar !== undefined ? pendingAvatar : (user.avatar || '')
    };

    if (newEmail !== user.email) delete users[user.email];
    users[newEmail] = updated;
    window.SolarM.saveUsers(users);
    window.SolarM.setSession(newEmail);
    window.SolarM.updateAuthUI();

    msg.textContent = 'Profile updated!';
    msg.className = 'auth-msg ok';
    window.SolarM.toast('Your profile has been updated.');
    pendingAvatar = undefined;
    passwordEl.value = '';
  });

  document.addEventListener('solarm:authchange', render);
  render();
})();
