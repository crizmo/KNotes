/*
    KNotes

    Kurizu & Penguins (a bit)
*/

//Chromebar
function update() {
    var chromebar = {
        "appId": "xyz.kurizu.knotes",
        "topNavBar": {
            "template": "title",
            "title": "KNotes",
            "buttons": [
                { "id": "KPP_MORE", "state": "enabled", "handling": "system" },
                { "id": "KPP_CLOSE", "state": "enabled", "handling": "system" }
            ]
        },
        "systemMenu": {
            "clientParams": {
                "profile": {
                    "name": "default",
                    "items": [
                        { "id": "KNOTES_RELOAD", "state": "enabled", "handling": "notifyApp", "label": "Reload", "position": 0 }
                    ],
                    "selectionMode": "none",
                    "closeOnUse": true
                }
            }
        }
    };
    window.kindle.messaging.sendMessage("com.lab126.chromebar", "configureChrome", chromebar);
}

window.kindle.appmgr.ongo = function (ctx) {
    update();
    window.kindle.messaging.receiveMessage("systemMenuItemSelected", function (type, id) {
        switch (id) {
            case "KNOTES_RELOAD":
                window.location.reload();
        }
    });
};

//Helpers
function _read(name, fullPath) {
    return new Promise(function(resolve) {
        var file = fullPath ? name : "file:///mnt/us/documents/KNotes/notes/" + name + ".knt";

        var iframe = document.createElement("iframe");
        iframe.src = file;
        document.body.appendChild(iframe);
        iframe.addEventListener("load", function(e) {
            try {
                var src = e.target.contentDocument.documentElement.innerHTML;
                e.target.remove();

                if (!fullPath) {
                    src = src.replace(/<[^>]+>/g, "")
                             .replace(/\r/g, "\n")
                             .replace(/\n+/g, "\n")
                             .trim();

                    src = decodeURIComponent(escape(atob(src)));
                }
                resolve(src);
            } catch (err) {
                console.error("Failed To Read File:", err);
                resolve("");
            }
        });
        setTimeout(function() { if (iframe.parentNode) iframe.remove(); }, 2000);
    });
}

function _write(name, data) {
    return new Promise(function(resolve) {
        var filepath = "/mnt/us/documents/KNotes/notes/" + name + ".knt";

        var encoded = btoa(unescape(encodeURIComponent(data)));
        (window.kindle || top.kindle).messaging.sendStringMessage(
            "com.kindlemodding.utild",
            "runCMD",
            "echo '" + encoded + "' > " + filepath
        );
        setTimeout(resolve, 300);
    });
}

function _list() {
    return new Promise(function(resolve) {
        var dirPath = "file:///mnt/us/documents/KNotes/notes/";
        _read(dirPath, true).then(function(data) {
            var files = [];
            var tagReg = /<a(\n|.)*?(?=<\/a>)/gim;
            var hrefReg = /href="(\n|.)*?(?=")/gim;

            var anchorTags = Array.from(data.matchAll(tagReg));
            for (var i = 0; i < anchorTags.length; i++) {
                var source = Array.from(anchorTags[i][0].matchAll(hrefReg));
                if (source.length) {
                    var path = source[0][0].substring(6);
                    var name = path.split("/").pop().replace(".knt","");
                    files.push(name);
                }
            }
            resolve(files);
        }).catch(function(err) {
            console.error("Error Reading Notes Directory:", err);
            resolve([]);
        });
    });
}

function _delete(name) {
    return new Promise(function(resolve) {
        var filepath = "/mnt/us/documents/KNotes/notes/" + name + ".knt";
        (window.kindle || top.kindle).messaging.sendStringMessage(
            "com.kindlemodding.utild",
            "runCMD",
            "rm '" + filepath + "'"
        );
        setTimeout(resolve, 300);
    });
}

// Global variables
var currentNote = null;
var notesList = [];

// UI Functions
function showMessage(text, type) {
    var message = document.getElementById("message");
    message.textContent = text;
    message.style.display = "block";
    message.style.borderStyle = type === "error" ? "dashed" : "solid";
    setTimeout(function() {
        message.style.display = "none";
    }, 3000);
}

function loadNotesList() {
    _list().then(function(notes) {
        notesList = notes;
        var container = document.getElementById("notes-container");
        container.innerHTML = "";

        if (notes.length === 0) {
            container.innerHTML = "<p>No notes yet. Create your first note!</p>";
            return;
        }

        notes.forEach(function(note) {
            var noteItem = document.createElement("button");
            noteItem.className = "note-item";
            noteItem.textContent = note;
            noteItem.onclick = function() { selectNote(note); };
            if (currentNote === note) {
                noteItem.classList.add("active");
            }
            container.appendChild(noteItem);
        });
    });
}

function selectNote(name) {
    currentNote = name;
    document.getElementById("current-note-title").textContent = name;
    document.getElementById("save-button").disabled = false;
    document.getElementById("delete-button").disabled = false;

    _read(name).then(function(content) {
        document.getElementById("note-content").value = content;
    });

    document.getElementById('editor').style.display = 'block'; // Show editor when selecting a note
    document.getElementById('toggle-editor').textContent = 'Hide Editor';

    loadNotesList(); // Refresh to show active state
}

function createNewNote() {
    document.getElementById("new-note-name").value = "";
    document.getElementById("create-modal").style.display = "block";
    document.getElementById("new-note-name").focus();
    
    // Add keyboard support
    var input = document.getElementById("new-note-name");
    var handleKeyPress = function(e) {
        if (e.key === "Enter") {
            confirmCreateNote();
        } else if (e.key === "Escape") {
            closeCreateModal();
        }
    };
    input.addEventListener("keydown", handleKeyPress);
    
    // Store the handler to remove it later
    input._keyHandler = handleKeyPress;
}

function confirmCreateNote() {
    var name = document.getElementById("new-note-name").value.trim();
    if (name === "") {
        showMessage("Please enter a note name!", "error");
        return;
    }

    if (notesList.includes(name)) {
        showMessage("A note with this name already exists!", "error");
        return;
    }

    _write(name, "").then(function() {
        showMessage("New note created!");
        loadNotesList();
        selectNote(name);
        closeCreateModal();
    });
}

function closeCreateModal() {
    var input = document.getElementById("new-note-name");
    if (input._keyHandler) {
        input.removeEventListener("keydown", input._keyHandler);
        delete input._keyHandler;
    }
    document.getElementById("create-modal").style.display = "none";
}

function closeCreateModal() {
    document.getElementById("create-modal").style.display = "none";
}

function saveNote() {
    if (!currentNote) return;

    var content = document.getElementById("note-content").value;
    _write(currentNote, content).then(function() {
        showMessage("Note saved!");
    });
}

function deleteNote() {
    if (!currentNote) return;
    document.getElementById("delete-modal").style.display = "block";
}

function confirmDelete() {
    if (!currentNote) return;

    _delete(currentNote).then(function() {
        showMessage("Note deleted!");
        currentNote = null;
        document.getElementById("current-note-title").textContent = "Select a note to edit";
        document.getElementById("note-content").value = "";
        document.getElementById("save-button").disabled = true;
        document.getElementById("delete-button").disabled = true;
        document.getElementById('editor').style.display = 'none'; // Hide editor after delete
        document.getElementById('toggle-editor').textContent = 'Show Editor';
        loadNotesList();
        closeDeleteModal();
    });
}

function closeDeleteModal() {
    document.getElementById("delete-modal").style.display = "none";
}

//Logic
function onPageLoad() {
    loadNotesList();
    document.getElementById('toggle-editor').textContent = 'Hide Editor'; // Since editor is visible by default

    // Handle viewport changes for mobile keyboard
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', adjustTextareaForKeyboard);
        var textarea = document.getElementById('note-content');
        textarea.addEventListener('focus', adjustTextareaForKeyboard);
        textarea.addEventListener('input', adjustTextareaForKeyboard); // Adjust as you type
        textarea.addEventListener('blur', resetTextarea);
    }
}

function toggleEditor() {
    var editor = document.getElementById('editor');
    var button = document.getElementById('toggle-editor');
    if (editor.style.display === 'none') {
        editor.style.display = 'block';
        button.textContent = 'Hide Editor';
    } else {
        editor.style.display = 'none';
        button.textContent = 'Show Editor';
    }
}

function adjustTextareaForKeyboard() {
    var textarea = document.getElementById('note-content');
    if (document.activeElement === textarea && window.visualViewport) {
        if (textarea.scrollHeight > 80) { // Adjust after content exceeds ~3-4 lines height
            textarea.style.minHeight = (window.visualViewport.height - 200) + 'px';
            textarea.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }
}

function resetTextarea() {
    var textarea = document.getElementById('note-content');
    textarea.style.minHeight = ''; // Reset to original
}
