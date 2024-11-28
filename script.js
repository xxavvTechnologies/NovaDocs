let auth0 = null;

window.onload = async () => {
    // Initialize Auth0 client
    await configureAuth0();

    // Handle the redirect if returning from login
    if (window.location.search.includes("code=") || window.location.search.includes("state=")) {
        await handleAuthRedirect();
    }

    // Update the UI
    await updateUI();

    // Attach event listener to the profile button
    const profileButton = document.getElementById("profile-button");
    profileButton.addEventListener("click", toggleDropdown);
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

const handleAuthRedirect = async () => {
    try {
        // Process the redirect callback and remove query parameters
        await auth0.handleRedirectCallback();
        window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
        console.error("Error handling Auth0 redirect:", error);
    }
};

const updateUI = async () => {
    const isAuthenticated = await auth0.isAuthenticated();
    const dropdownMenu = document.getElementById("dropdown-menu");

    // Clear and rebuild dropdown menu
    dropdownMenu.innerHTML = "";

    if (isAuthenticated) {
        const user = await auth0.getUser();

        // Add user-specific options
        dropdownMenu.innerHTML += `<a href="#">Welcome, ${user.name || "User"}</a>`;
        dropdownMenu.innerHTML += `<a href="#">Nova App 1</a>`;
        dropdownMenu.innerHTML += `<a href="#">Nova App 2</a>`;
        dropdownMenu.innerHTML += `<a href="#" id="logout">Logout</a>`;

        document.getElementById("logout").addEventListener("click", () => {
            auth0.logout({ returnTo: window.location.origin });
        });
    } else {
        // Add login option if not authenticated
        dropdownMenu.innerHTML += `<a href="#" id="login">Login</a>`;

        document.getElementById("login").addEventListener("click", async () => {
            await auth0.loginWithRedirect();
        });
    }
};

const toggleDropdown = () => {
    const dropdownMenu = document.getElementById("dropdown-menu");
    dropdownMenu.style.display = dropdownMenu.style.display === "block" ? "none" : "block";
};

// Close dropdown when clicking outside
window.addEventListener("click", (event) => {
    if (!event.target.closest(".user-dropdown")) {
        const dropdownMenu = document.getElementById("dropdown-menu");
        dropdownMenu.style.display = "none";
    }
});
