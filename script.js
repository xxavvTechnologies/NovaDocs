let auth0 = null;

window.onload = async () => {
    await configureAuth0();
    
    if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
        try {
            await auth0.handleRedirectCallback();
            window.history.replaceState({}, document.title, window.location.pathname);
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
        redirect_uri: 'https://docs.nova.xxavvgroup.com/callback',
        useRefreshTokens: true,
        cacheLocation: 'localstorage'
    });
};

const updateUI = async () => {
    const isAuthenticated = await auth0.isAuthenticated();
    
    // Show or hide login button
    document.getElementById('login').style.display = isAuthenticated ? 'none' : 'block';
    
    // Show dropdown if authenticated
    const userDropdown = document.getElementById('user-dropdown');
    userDropdown.style.display = 'block'; // Always show the dropdown

    if (isAuthenticated) {
        document.getElementById('editor').contentEditable = true;
        const user = await auth0.getUser();
        const profileButton = document.getElementById('profile-button');
        
        // Update profile button with user's picture or default icon
        if (user.picture) {
            profileButton.innerHTML = `<img src="${user.picture}" alt="Profile Picture" style="width: 40px; height: 40px; border-radius: 50%;">`;
        } else {
            profileButton.innerHTML = '<i class="fas fa-user-circle"></i>';
        }
        
        // Show dropdown content
        userDropdown.querySelector('.dropdown-content').style.display = 'block';
        
    } else {
        document.getElementById('editor').contentEditable = false;
        
        // Set default icon if not authenticated
        const profileButton = document.getElementById('profile-button');
        profileButton.innerHTML = '<i class="fas fa-user-circle"></i>';
        
        // Hide dropdown content
        userDropdown.querySelector('.dropdown-content').style.display = 'none';
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