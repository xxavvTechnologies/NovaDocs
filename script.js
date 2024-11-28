let auth0 = null;

window.onload = async () => {
    await configureAuth0();

    // Handle redirect callback
    if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
        try {
            await auth0.handleRedirectCallback();
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
            console.error("Error handling redirect:", error);
        }
    }

    // Attach global event listener for clicks
    document.body.addEventListener("click", handleBodyClick);

    await updateUI();
};

const configureAuth0 = async () => {
    auth0 = await createAuth0Client({
        domain: "auth.novawerks.xxavvgroup.com",
        client_id: "RGfDMp59V4UhqLIBZYwVZqHQwKly3lQ3",
        redirect_uri: window.location.origin,
        useRefreshTokens: true,
        cacheLocation: "localstorage"
    });
};

const updateUI = async () => {
    const isAuthenticated = await auth0.isAuthenticated();
    document.getElementById("login").style.display = isAuthenticated ? "none" : "block";
    document.getElementById("user-dropdown").style.display = isAuthenticated ? "block" : "none";

    if (isAuthenticated) {
        const user = await auth0.getUser();
        const profileButton = document.getElementById("profile-button");

        if (user.picture) {
            profileButton.innerHTML = `<img src="${user.picture}" alt="Profile Picture" style="width: 40px; height: 40px; border-radius: 50%;">`;
        }
    }
};

document.getElementById("login").addEventListener("click", async () => {
    await auth0.loginWithRedirect();
});

document.getElementById("logout").addEventListener("click", () => {
    auth0.logout({ returnTo: "https://docs.nova.xxavvgroup.com" });
});

const handleBodyClick = (event) => {
    const dropdownMenu = document.getElementById("dropdown-menu");
    const profileButton = document.getElementById("profile-button");

    // If clicking on the profile button, toggle the dropdown
    if (profileButton.contains(event.target)) {
        dropdownMenu.style.display = dropdownMenu.style.display === "block" ? "none" : "block";
    } else {
        // Hide dropdown if clicking anywhere else
        dropdownMenu.style.display = "none";
    }
};
