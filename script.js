let auth0 = null;

window.onload = async () => {
    await configureAuth0();
    
    // Clear any existing authentication state
    await auth0.logout({
        localOnly: true
    });
    
    if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
        try {
            await auth0.handleRedirectCallback();
            window.history.replaceState({}, document.title, window.location.pathname);
            await updateUI(); // Add this line
        } catch (error) {
            console.error("Error handling redirect:", error);
        }
    }
    
    await updateUI();
};

const configureAuth0 = async () => {
    auth0 = await createAuth0Client({
        domain: 'auth.novawerks.xxavvgroup.com',
        client_id: 'RGfDMp59V4UhqLIBZYwVZqHQwKly3lQ3',
        redirect_uri: window.location.origin,
        useRefreshTokens: true,
        cacheLocation: 'localstorage'
    });
};

const updateUI = async () => {
    const isAuthenticated = await auth0.isAuthenticated();
    document.getElementById('login').style.display = isAuthenticated ? 'none' : 'block';
    document.getElementById('user-dropdown').style.display = isAuthenticated ? 'block' : 'none';
    
    if (isAuthenticated) {
        document.getElementById('editor').contentEditable = true;
        const user = await auth0.getUser();
        document.getElementById('profile-button').addEventListener('click', () => {
            document.querySelector('.dropdown-content').style.display = 'block';
        });
        
        if (user.picture) {
            profileButton.innerHTML = `<img src="${user.picture}" alt="Profile Picture">`;
        } else {
            profileButton.innerHTML = '<i class="fas fa-user-circle"></i>';
        }
    } else {
        document.getElementById('editor').contentEditable = false;
    }
};

document.getElementById('login').addEventListener('click', async () => {
    await auth0.loginWithRedirect();
});

document.getElementById('logout').addEventListener('click', () => {
    console.log('Logout clicked');
    auth0.logout({
        returnTo: 'https://docs.nova.xxavvgroup.com'
    });
});

const getUserProfile = async () => {
    if (await auth0.isAuthenticated()) {
        const user = await auth0.getUser();
        console.log(user);
    }
};