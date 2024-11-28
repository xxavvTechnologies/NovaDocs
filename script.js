let auth0 = null;

window.onload = async () => {
    await configureAuth0();
    
    // Check for the code and state parameters
    const query = window.location.search;
    if (query.includes("code=") && query.includes("state=")) {
        // Handle the redirect and retrieve the token
        await auth0.handleRedirectCallback();
        // Update the UI
        updateUI();
        // Remove the query parameters from the URL
        window.history.replaceState({}, document.title, "/");
    } else {
        updateUI();
    }
};

const configureAuth0 = async () => {
    auth0 = await createAuth0Client({
        domain: 'dev-oex5fnsu3gh2tvi2.us.auth0.com',
        client_id: 'RGfDMp59V4UhqLIBZYwVZqHQwKly3lQ3',
        redirect_uri: 'https://docs.nova.xxavvgroup.com/callback'
    });
};

const updateUI = async () => {
    const isAuthenticated = await auth0.isAuthenticated();
    document.getElementById('login').style.display = isAuthenticated ? 'none' : 'block';
    document.getElementById('logout').style.display = isAuthenticated ? 'block' : 'none';
    
    if (isAuthenticated) {
        document.getElementById('editor').contentEditable = true;
        await getUserProfile();
    } else {
        document.getElementById('editor').contentEditable = false;
    }
};

const getUserProfile = async () => {
    if (await auth0.isAuthenticated()) {
        const user = await auth0.getUser();
        console.log(user);
        // You can use the user object to display user information
    }
};

document.getElementById('login').addEventListener('click', async () => {
    await auth0.loginWithRedirect();
});

document.getElementById('logout').addEventListener('click', () => {
    auth0.logout({
        returnTo: 'https://docs.nova.xxavvgroup.com'
    });
});

// Add more functionality for saving and loading documents here