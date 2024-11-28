let auth0 = null;

window.onload = async () => {
    await configureAuth0();
    updateUI();
};

const configureAuth0 = async () => {
    auth0 = await createAuth0Client({
        domain: 'dev-oex5fnsu3gh2tvi2.us.auth0.com',
        client_id: 'RGfDMp59V4UhqLIBZYwVZqHQwKly3lQ3',
        redirect_uri: window.location.origin
    });
};

const updateUI = async () => {
    const isAuthenticated = await auth0.isAuthenticated();
    document.getElementById('login').style.display = isAuthenticated ? 'none' : 'block';
    document.getElementById('logout').style.display = isAuthenticated ? 'block' : 'none';
    
    if (isAuthenticated) {
        document.getElementById('editor').contentEditable = true;
    } else {
        document.getElementById('editor').contentEditable = false;
    }
};

document.getElementById('login').addEventListener('click', async () => {
    await auth0.loginWithRedirect();
});

document.getElementById('logout').addEventListener('click', () => {
    auth0.logout({
        returnTo: window.location.origin
    });
});

// Add more functionality for saving and loading documents here