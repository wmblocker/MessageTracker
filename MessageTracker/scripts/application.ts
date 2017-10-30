"use strict";
import MessageTracker = require('./types');

export function initialize(): void {
    document.addEventListener('deviceready', onDeviceReady, false);
    document.addEventListener('pause', onPause, false);
    document.addEventListener('resume', onResume, false);
}

let client: Microsoft.WindowsAzure.MobileServiceClient;
let currentUser: MessageTracker.User = {};
let isLoggedIn: Boolean = false;
let deviceUserID: string;
let deviceFlag: boolean;
let userTable: Microsoft.WindowsAzure.MobileServiceTable;
let deviceTable: Microsoft.WindowsAzure.MobileServiceTable;
let messagesTable: Microsoft.WindowsAzure.MobileServiceTable;
let userDevicesTable: Microsoft.WindowsAzure.MobileServiceTable;
let feedbackTable: Microsoft.WindowsAzure.MobileServiceTable;
let requestsTable: Microsoft.WindowsAzure.MobileServiceTable;
let messagesArray: Array<MessageTracker.MessagesTable> = [];
let admobId : MessageTracker.Ad;

function onDeviceReady(): void {
    checkTerms();
    client = new WindowsAzure.MobileServiceClient("https://blockertechmessagetracker.azurewebsites.net");
    userTable = client.getTable("Users");
    deviceTable = client.getTable("Devices");
    messagesTable = client.getTable("Messages");
    requestsTable = client.getTable("Requests");
    userDevicesTable = client.getTable("UserDevices");
    feedbackTable = client.getTable("Feedback");
    intializeDevice();
    initializeBackgroundMode();

    $('#signInWithGoogle').click(startLogin);
    $('#sendRequest').click(createDeviceRequest);
    $('#refreshButton').click(refreshDevice);
    $('#agreeButton').click(setTermsToAgreed);
    $('#dontAgreeButton').click(setTermsToDisagree);
    $('#sendFeedback').click(sendFeedback);
    $('#navTermsPage').click(showTermsPageFromProfile);
    $('#navPrivacyPage').click(showPrivacyPageFromProfile);
    $('#removeDeviceButton').click(showRemovePage);
    $('#removePageBack').click(removeToProfile);
    $('#viewRequestsButton').click(showRequests);
    $('#requestsPageBack').click(requestToProfile);
    $('#messagesPageBack').click(messagesToDevice);
    $('#devicesPageBack').click(devicesToProfile);
    $('#termsPageButton').click(showTermsPageFromMain);
    $('#termsPageBack').click(showMainPageFromTerms);
    $('#privacyPageBack').click(showMainPageFromPrivacy);
    $('#privacyPageButton').click(showPrivacyPageFromMain);
    $('#howToUse').click(showHowToUsePage);
    $('#howToUsePageBack').click(hideHowToUsePage);
    $('#supportButton').click(supportPrompt);
    $('#profileSupportButton').click(supportPrompt);
    $('#donateButton').click(showDonatePage);
    $('#donatePageBack').click(hideDonatePage);

    cordova.plugins.SMSRetriever.startWatch();
    $('.loader').fadeOut(function () {
        initializePages();
        initializeAd();
    });
}

function checkTerms(): void {
    if (localStorage.getItem("terms") == null || localStorage.getItem("terms") == "false") {
        agreeToTerms();
        $('#termsPageBack').click(showMainPageFromTerms)
    }
    else {
        $('#terms-bottom-navbar').hide();
        $('#termsPageBack').click(showMainPageFromTerms);
    }
}

function setTermsToAgreed(): void {
    localStorage.setItem("terms", "true");
    showMainPageFromTerms();
    //$('#signInWithGoogle').show();
}

function setTermsToDisagree(): void {
    localStorage.setItem("terms", "false");
    showMainPageFromTerms();
    supportPrompt();
    messagePrompt("Please agree to the terms & conditions before signing in.");
    //$('#signInWithGoogle').hide();
}

function checkConnection() {
    var networkState = navigator.connection.type;
    var states = {};
    states[Connection.UNKNOWN] = 'Unknown connection';
    states[Connection.ETHERNET] = 'Ethernet connection';
    states[Connection.WIFI] = 'WiFi connection';
    states[Connection.CELL_2G] = 'Cell 2G connection';
    states[Connection.CELL_3G] = 'Cell 3G connection';
    states[Connection.CELL_4G] = 'Cell 4G connection';
    states[Connection.CELL] = 'Cell generic connection';
    states[Connection.NONE] = 'No network connection';

    if (states[networkState] == 'No network connection') {
        console.log("No network connection");
        return false;
    }
    else {
        console.log("Connected to network");
        return true;
    }
}

function initializeAd(): void {
    //// select the right Ad Id according to platform
    if (/(android)/i.test(navigator.userAgent)) { // for android & amazon-fireos
        admobId = {
            banner: 'ca-app-pub-4672297660394369/5804478107', // or DFP format "/6253334/dfp_example_ad"
            interstitial: 'ca-app-pub-4672297660394369/5836267699'
        };
    }
    if (AdMob) AdMob.createBanner({
        adId: admobId.banner,
        position: AdMob.AD_POSITION.BOTTOM_CENTER,
        autoShow: true,
        isTesting: false
    });
}


function agreeToTerms(): void {
    navigator.notification.confirm(
        "You must read and agree to the terms and conditions before using the Message Tracker.",
        function (buttonIndex) {
            if (buttonIndex == 1) {
                showTermsPageFromMain();
            }
            else {
                supportPrompt();
            }
        },
        "Message Tracker",
        ["Ok", "Cancel"]
    );
}


function intializeDevice(): void {
    deviceTable
        .where({ uuid: device.uuid })
        .read()
        .then(function (results) {
            if (results.length > 0) {
                deviceUserID = results[0].UserID;
                deviceFlag = true;
            }
            else {
                deviceFlag = false;
            }
        });
}



function initializeBackgroundMode(): void {
    cordova.plugins.backgroundMode.enable();
    cordova.plugins.backgroundMode.overrideBackButton();
    cordova.plugins.backgroundMode.setDefaults({
        title: "Message Tracker",
        text: "Message tracking in background",
        icon: 'icon.png',
        color: '000', // hex format like 'F14F4D' 
        resume: true,
        hidden: true,
        //bigText: Boolean
    });
}

function startLogin(): void {
    if (localStorage.getItem("terms") == null || localStorage.getItem("terms") == "false") {
        agreeToTerms();
        $('#termsPageBack').click(showMainPageFromTerms)
    }
    else {
        $('#terms-bottom-navbar').hide();
        $('#termsPageBack').click(showMainPageFromTerms);
        if (checkConnection() == true) {
            if (deviceFlag == false) {
                navigator.notification.confirm(
                    "Once logged in, this device and all Messages will be bound to your account. Do you wish to continue?",
                    function (buttonIndex) {
                        if (buttonIndex == 1) {
                            loginGoogle();
                        }
                        else {
                            supportPrompt();
                        }
                    },
                    "Message Tracker",
                    ["OK", "Cancel"]
                );
            }
            else {
                loginGoogle();
            }
        }
        else {
            messagePrompt("Your celluar data or wifi must be on to use this app.");
        }
    }
}

function loginGoogle(): void {
    let lockedOut: Boolean = false;
    client.login('google')
        .then(function () {
            callAuthMe(function (result) {
                currentUser.firstName = searchForGivenName(result);
                currentUser.lastName = searchForSurName(result);
                currentUser.email = result[0].user_id;
                currentUser.emailVerified = searchForEmailVerified(result);
                currentUser.picture = searchForPicture(result);
                userTable
                    .where({ userId: client.currentUser.userId })
                    .read()
                    .then(function (results) {
                        if (results.length <= 0) {
                            if (currentUser.emailVerified == false) {
                                messagePrompt("Please verify your email before you use the Message Tracker");
                            }
                            else {
                                userTable.insert({
                                    userId: client.currentUser.userId, email: currentUser.email, firstName: currentUser.firstName,
                                    lastName: currentUser.lastName, lockedOut: false, emailVerified: currentUser.emailVerified, picture: currentUser.picture
                                });
                                onSuccessfulLogin();
                            }
                        }
                        else {
                            currentUser.id = results[0].id;
                            userTable.update(currentUser);
                            if (results[0].lockedOut == false) {
                                onSuccessfulLogin();
                            }
                            else {
                                messagePrompt("Your account has been locked. Please contact the support team at support@blockertech.com");
                            }
                        }
                    }).done(function () {
                        if (deviceFlag == false) {

                            deviceTable
                                .insert({
                                    uuid: device.uuid,
                                    userId: client.currentUser.userId,
                                    nickName: currentUser.firstName + "'s " + device.model
                                });
                        }
                    });

            }, function (error) {
                console.log(error.message);
            });
        }, function (error) {
            console.log(error.message);
        });
}

function searchForPicture(result): string {
    for (var i in result[0]["user_claims"]) {
        var pos = -1;
        var str = result[0]["user_claims"][i]["typ"];
        pos = str.search("picture");
        if (pos >= 0) {
            str = result[0]["user_claims"][i]["val"];
            var url = str.replace(/\\/g, "");
            console.log("Picture : " + url);
            return url;
        }
    }
}

function searchForEmailVerified(result): Boolean {
    for (var i in result[0]["user_claims"]) {
        var pos = -1;
        var str = result[0]["user_claims"][i]["typ"];
        pos = str.search("email_verified");
        if (pos >= 0) {
            if (result[0]["user_claims"][i]["val"] == "false") {
                console.log("Email verified");
                return false;
            }
            else {
                console.log("Email not verified");
                return true;
            }
        }
    }
}

function searchForGivenName(result): string {
    for (var i in result[0]["user_claims"]) {
        var pos = -1;
        var str = result[0]["user_claims"][i]["typ"];
        pos = str.search("givenname");
        if (pos >= 0) {
            return result[0]["user_claims"][i]["val"];
        }
    }
}

function searchForSurName(result): string {
    for (var i in result[0]["user_claims"]) {
        var pos = -1;
        var str = result[0]["user_claims"][i]["typ"];
        pos = str.search("surname");
        if (pos >= 0) {
            return result[0]["user_claims"][i]["val"];
        }
    }
}

function onSuccessfulLogin(): void {
    $("#mainPage").fadeOut(function () {
        if (AdMob) AdMob.prepareInterstitial({ adId: admobId.interstitial, autoShow: true, isTesting: false });
    });
    //startTempTracker();
    isLoggedIn = true;
    setProfile();
    loadData();
    getData();
    document.addEventListener('onSMSArrive', (result: any) => {
        let sms = result.data;
        let date = new Date(sms.date_sent);
        let time = date.toLocaleTimeString();
        messagesTable.insert({ messageSender: sms.address, messageBody: sms.body, date: date.toLocaleDateString() + " " +time, uuid: device.uuid });

    });
}

function setProfile(): void {
    $('#profile-picture-container').empty();
    var img = document.createElement("img");
    img.setAttribute("src", currentUser.picture);
    img.className = "w3-center";

    $('#userWelcome').text("Welcome, " + currentUser.firstName)
    $('#profile-picture-container').append(img);
}

function callAuthMe(successCallback, failCallback) {
    var req = new XMLHttpRequest();
    req.open("GET", "https://blockertechmessagetracker.azurewebsites.net" + "/.auth/me", true);
    req.setRequestHeader('X-ZUMO-AUTH', client.currentUser.mobileServiceAuthenticationToken);
    req.onload = function (e: any) {
        if (e.target.status >= 200 && e.target.status < 300) {
            console.log(e.target.response);
            successCallback(JSON.parse(e.target.response));
            return;
        }
        failCallback('Data request failed. Status ' + e.target.status + ' ' + e.target.response);
    };
    req.onerror = function (e) {
        failCallback('Data request failed: ' + e.error);
    };
    req.send();
}

function getData(): void {
    setInterval(function () {
        populateCurrentDevices();
        populateRequests();
        removeDeviceRequest();
    }, 180000);
}

function loadData(): void {
    hidePages();
    $('.loader').fadeIn(function () {
        populateCurrentDevices();
        populateRequests();
        removeDeviceRequest();

    });

    setTimeout(function () {
        $('.loader').fadeOut(function () {
            $('#profilePage').fadeIn();
        })
    }, 2000);

}

function populateCurrentDevices(): void {
    $('#devicesTableBody').empty();

    userDevicesTable
        .where({ grantedUserId: currentUser.email, permission: true })
        .read()
        .then(function (results) {

            for (var i = 0; i < results.length; i++) {
                userTable.where({ userId: results[i].userId })
                    .read()
                    .then(function (result) {
                        var tdView = document.createElement("td");
                        var tdPicture = document.createElement("td");
                        var picture = document.createElement("img");
                        var viewBtn = document.createElement("a");
                        var viewGlyph = document.createElement("span");
                        var tdUser = document.createElement("td");
                        var tr = document.createElement("tr");

                        viewGlyph.className = "glyphicon glyphicon-eye-open"
                        viewGlyph.style.fontSize = "18px";

                        tdUser.innerText = result[0].email;

                        viewBtn.appendChild(viewGlyph);
                        viewBtn.onclick = function () {
                            loadUserDevices(result[0].userId);
                        };



                        tdView.appendChild(viewBtn);
                        tr.appendChild(tdUser);
                        tr.appendChild(tdView);

                        $('#devicesTableBody').append(tr);
                    });
            }

        });
}

function populateRequests(): void {
    $('#requestsTableBody').empty();
    requestsTable
        .where({ requestTo: currentUser.email, deleted: false })
        .read()
        .then(function (results) {
            $("#requestsCount").text(results.length);
            for (var i = 0; i < results.length; i++) {
                var requestFrom = results[i].requestFrom;
                var requestID = results[i].id;
                var tr = document.createElement("tr");

                var tdUser = document.createElement("td");
                tdUser.innerText = requestFrom;

                var tdApprove = document.createElement("td");
                var tdDeny = document.createElement("td");

                var approveBtn = document.createElement("button");
                approveBtn.className = "btn btn-default";
                approveBtn.onclick = function () {
                    navigator.notification.confirm(
                        "Are you sure you want to grant " + requestFrom + " permission to monitor your messages?",
                        function (buttonIndex) {
                            if (buttonIndex == 1) {
                                approveRequest(tr, requestID, requestFrom);
                            }
                        },
                        "Confirm",
                        ["Yes", "No"]
                    );

                };

                var denyBtn = document.createElement("button");
                denyBtn.className = "btn btn-default";
                denyBtn.onclick = function () {
                    navigator.notification.confirm(
                        "Are you sure you want to deny " + requestFrom + " permission to monitor your messages?",
                        function (buttonIndex) {
                            if (buttonIndex == 1) {
                                denyRequest(tr, requestID, requestFrom);
                            }
                        },
                        "Confirm",
                        ["Yes", "No"]
                    );

                };

                var okGlyph = document.createElement("span");
                okGlyph.className = "glyphicon glyphicon-ok-sign";
                okGlyph.style.color = "green";

                var denyGlyph = document.createElement("span");
                denyGlyph.className = "glyphicon glyphicon-remove-sign";
                denyGlyph.style.color = "red";

                approveBtn.appendChild(okGlyph);
                denyBtn.appendChild(denyGlyph);

                tdApprove.appendChild(approveBtn);
                tdDeny.appendChild(denyBtn);

                tr.appendChild(tdUser);
                tr.appendChild(tdApprove);
                tr.appendChild(tdDeny);


                $('#requestsTableBody').append(tr);
            }

        });
}

function approveRequest(tr: HTMLTableRowElement, requestId: string, requestFrom: any): void {
    var request = { id: requestId, requestTo: currentUser.email, requestFrom: requestFrom, permission: true, deleted: true };
    requestsTable.update(request).then(function () {
        messagePrompt("Request Approved");
    }).done(function () {
        requestsTable.del({ id: requestId });
        $(tr).fadeOut(500, function () {
            $(tr).remove();
            let currentRequests: number = parseInt($("#requestsCount").text());
            if (currentRequests > 0) {
                currentRequests--;
            }
            $("#requestsCount").text(currentRequests);
        });
    });
    deviceTable
        .where({ UserID: client.currentUser.userId })
        .read()
        .then(function (results) {
            for (var i = 0; i < results.length; i++) {
                userDevicesTable.insert({
                    UserID: client.currentUser.userId,
                    permission: true,
                    grantedUserId: requestFrom,
                    uuid: results[i].uuid
                });
            }
        });
}

function denyRequest(tr: HTMLTableRowElement, requestId: string, requestFrom: any): void {
    var request = { id: requestId, requestTo: currentUser.email, requestFrom: requestFrom, permission: false, deleted: true };
    requestsTable.update(request).then(function () {
        messagePrompt("Request Denied");
    }).done(function () {
        requestsTable.del({ id: requestId });
        $(tr).fadeOut(500, function () {
            $(tr).remove();
            let currentRequests: number = parseInt($("#requestsCount").text());
            if (currentRequests > 0) {
                currentRequests--;
            }
            $("#requestsCount").text(currentRequests);
        });
    });
}


function createDeviceRequest(): void {
    var user = $('#requestedUserEmail').val();

    if (user == "") {
        messagePrompt("Field cannot be empty");
    }

    else {
        if (user == currentUser.email) {
            messagePrompt("You cannot send a request to yourself.");
        }
        else {
            requestsTable
                .where({ requestFrom: currentUser.email, requestTo: user })
                .read()
                .then(function (results) {
                    if (results < 1) {
                        userTable
                            .where({ email: user })
                            .read()
                            .then(function (results) {
                                if (results.length > 0) {
                                    requestsTable.insert({
                                        requestFrom: currentUser.email,
                                        requestTo: user,
                                        permission: false
                                    }).then(function () {
                                        messagePrompt("Request Sent");
                                    });
                                }
                                else {
                                    messagePrompt("Email not found");
                                }
                            });
                    }
                    else {
                        messagePrompt("You already sent a request to this user.")
                    }
                });
        }
    }
}


function removeDeviceRequest(): void {
    $('#removeTableBody').empty();
    userDevicesTable
        .where({ userId: client.currentUser.userId, permission: true, deleted: false })
        .read()
        .then(function (results) {
            for (var i = 0; i < results.length; i++) {
                var grantedUser = results[i].grantedUserId;
                var permissionId = results[i].id;
                var tr = document.createElement("tr");

                var tdUser = document.createElement("td");
                tdUser.innerText = grantedUser;

                var tdRemove = document.createElement("td");

                var removeBtn = document.createElement("button");
                removeBtn.className = "btn btn-default";
                removeBtn.onclick = function () {
                    navigator.notification.confirm(
                        "Are you sure you want to stop " + grantedUser + " from having access to your messages?",
                        function (buttonIndex) {
                            if (buttonIndex == 1) {
                                removeUser(tr, permissionId, grantedUser);
                            }
                        },
                        "Confirm",
                        ["Yes", "No"]
                    );

                };

                var denyGlyph = document.createElement("span");
                denyGlyph.className = "glyphicon glyphicon-remove-sign";
                denyGlyph.style.color = "red";

                removeBtn.appendChild(denyGlyph);

                tdRemove.appendChild(removeBtn);

                tr.appendChild(tdUser);
                tr.appendChild(tdRemove);


                $('#removeTableBody').append(tr);
            }

        });
}

function removeUser(tr: HTMLTableRowElement, permissionId: string, grantedUser: string): void {
    var permission = { id: permissionId, grantedUserId: grantedUser, permission: false };
    userDevicesTable.update(permission).then(function () {
        messagePrompt("User removed");
    }).done(function () {
        userDevicesTable.del({ id: permissionId });
        $(tr).fadeOut(500, function () {
            $(tr).remove();
        });
    });
}


function refreshDevice(): void {
    loadData();
}

function loadUserDevices(user: string): void {
    $('#userDevicesTableBody').empty();
    deviceTable.where({ userId: user })
        .read()
        .then(function (results) {
            if (results.length > 0) {
                for (var i = 0; i < results.length; i++) {
                    var tr = document.createElement("tr");

                    var tdDevice = document.createElement("td");
                    tdDevice.innerText = results[i].nickName;

                    var tdView = document.createElement("td");

                    var viewBtn = document.createElement("a");
                    var viewGlyph = document.createElement("span");
                    viewGlyph.className = "glyphicon glyphicon-eye-open"
                    viewGlyph.style.fontSize = "18px";
                    viewBtn.appendChild(viewGlyph);
                    viewBtn.onclick = function () {
                        loadMessages(results[0].uuid);
                    };

                    tdView.appendChild(viewBtn);
                    tr.appendChild(tdDevice);
                    tr.appendChild(tdView);

                    $('#userDevicesTableBody').append(tr);
                }
                showDevicesPage();
            }

        });

}

function loadMessages(uuid: string): void {
    $('#messagesTableBody').empty();
    messagesTable.where({ uuid: uuid })
        .read()
        .then(function (results) {
            if (results.length > 0) {
                for (var i = 0; i < results.length; i++) {
                    console.log(results[i]);
                    var tr = document.createElement("tr");
                    var tdMessage = document.createElement("td");
                    var tdSender = document.createElement("td");
                    var tdDate = document.createElement("td");
                    tdMessage.innerText = results[i].messageBody;
                    tdSender.innerText = results[i].messageSender;
                    tdDate.innerText = results[i].date;

                    tr.appendChild(tdMessage);
                    tr.appendChild(tdSender);
                    tr.appendChild(tdDate);

                    $('#messagesTableBody').append(tr);
                }
            }
        }).done(showMessagesPage);
}

function sendFeedback(): void {
    var feedback = $('#feedBackInput').val();

    if (feedback == "") {
        messagePrompt("Field cannot be empty");
    }

    else {
        feedbackTable.insert({ feedback: feedback, user: currentUser.email });
        messagePrompt("Thank you for your feedback!");
    }
}

function onPause(): void {
    // TODO: This application has been suspended. Save application state here.
}

function onResume(): void {
    if (checkConnection() == false) {
        initializePages();
        messagePrompt("Your celluar data or wifi must be on to use this app.");
    }
}



//PAGE FUNCTIONS


function hidePages(): void {
    $("#mainPage").fadeOut(function () {
        document.getElementById("mainPage").style.visibility = "visible";
    });
    $("#profilePage").fadeOut(function () {
        document.getElementById("profilePage").style.visibility = "visible";
    });
    $("#settingsPage").fadeOut(function () {
        document.getElementById("settingsPage").style.visibility = "visible";
    });
    $("#termsPage").fadeOut(function () {
        document.getElementById("termsPage").style.visibility = "visible";
    });
    $("#privacyPage").fadeOut(function () {
        document.getElementById("privacyPage").style.visibility = "visible";
    });
    $("#requestsPage").fadeOut(function () {
        document.getElementById("requestsPage").style.visibility = "visible";
    });
    $("#messagesPage").fadeOut(function () {
        document.getElementById("messagesPage").style.visibility = "visible";
    });
    $("#devicesPage").fadeOut(function () {
        document.getElementById("devicesPage").style.visibility = "visible";
    });
    $("#removePage").fadeOut(function () {
        document.getElementById("removePage").style.visibility = "visible";
    });
    $("#howToUsePage").fadeOut(function () {
        document.getElementById("howToUsePage").style.visibility = "visible";
    });
    $("#donatePage").fadeOut(function () {
        document.getElementById("donatePage").style.visibility = "visible";
    });
}
function initializePages(): void {
    $("#mainPage").show(function () {
        document.getElementById("mainPage").style.visibility = "visible";
    });
    $("#profilePage").fadeOut(function () {
        document.getElementById("profilePage").style.visibility = "visible";
    });
    $("#settingsPage").fadeOut(function () {
        document.getElementById("settingsPage").style.visibility = "visible";
    });
    $("#termsPage").fadeOut(function () {
        document.getElementById("termsPage").style.visibility = "visible";
    });
    $("#privacyPage").fadeOut(function () {
        document.getElementById("privacyPage").style.visibility = "visible";
    });
    $("#requestsPage").fadeOut(function () {
        document.getElementById("requestsPage").style.visibility = "visible";
    });
    $("#messagesPage").fadeOut(function () {
        document.getElementById("messagesPage").style.visibility = "visible";
    });
    $("#devicesPage").fadeOut(function () {
        document.getElementById("devicesPage").style.visibility = "visible";
    });
    $("#removePage").fadeOut(function () {
        document.getElementById("removePage").style.visibility = "visible";
    });
    $("#howToUsePage").fadeOut(function () {
        document.getElementById("howToUsePage").style.visibility = "visible";
    });
    $("#donatePage").fadeOut(function () {
        document.getElementById("donatePage").style.visibility = "visible";
    });
}


function showRequests(): void {
    $("#profilePage").fadeOut(function () {
        $("#requestsPage").fadeIn();
    });
}

function requestToProfile(): void {
    $("#requestsPage").fadeOut(function () {
        $("#profilePage").fadeIn();
    });
}

function showMessagesPage(): void {
    $("#devicesPage").fadeOut(function () {
        $("#messagesPage").fadeIn();
    });
}

function messagesToDevice(): void {
    $("#messagesPage").fadeOut(function () {
        $("#devicesPage").fadeIn();
    });
}

function showDevicesPage(): void {
    $("#profilePage").fadeOut(function () {
        $("#devicesPage").fadeIn();
    });
}

function devicesToProfile(): void {
    $("#devicesPage").fadeOut(function () {
        $("#profilePage").fadeIn();
    });
}

function showRemovePage(): void {
    $("#profilePage").fadeOut(function () {
        $("#removePage").fadeIn();
    });
}

function removeToProfile(): void {
    $("#removePage").fadeOut(function () {
        $("#profilePage").fadeIn();
    });
}

function showTermsPageFromMain(): void {
    $("#mainPage").fadeOut(function () {
        $("#termsPage").fadeIn();
    });
}

function showTermsPageFromProfile(): void {
    $("#profilePage").fadeOut(function () {
        $("#termsPage").fadeIn();
    });
}

function showMainPageFromTerms(): void {
    $("#termsPage").fadeOut(function () {
        $("#mainPage").fadeIn();
    });
}

function showPrivacyPageFromMain(): void {
    $("#mainPage").fadeOut(function () {
        $("#privacyPage").fadeIn();
    });
}

function showMainPageFromPrivacy(): void {
    $("#privacyPage").fadeOut(function () {
        $("#mainPage").fadeIn();
    });
}

function showPrivacyPageFromProfile(): void {
    $("#profilePage").fadeOut(function () {
        $("#privacyPage").fadeIn();
    });
}

function showProfilePageFromTerms(): void {
    $("#profilePage").fadeOut(function () {
        $("#mainPage").fadeIn();
    });
}
function showHowToUsePage(): void {
    $("#mainPage").fadeOut(function () {
        $("#howToUsePage").fadeIn();
    });
}

function hideHowToUsePage(): void {
    $("#howToUsePage").fadeOut(function () {
        $("#mainPage").fadeIn();
    });
}
function showDonatePage(): void {
    $("#profilePage").fadeOut(function () {
        $("#donatePage").fadeIn();
    });
}

function hideDonatePage(): void {
    $("#donatePage").fadeOut(function () {
        $("#profilePage").fadeIn();
    });
}

///ALERTS
function messagePrompt(message): void {
    navigator.notification.alert(
        message,  // message
        function () { },         // callback
        'Message Tracker', // title
        'Done'                  // buttonName
    );
}

function supportPrompt(): void {
    navigator.notification.alert(
        "If you have any questions about the Message Tracker, please contact our support team support@blockertech.com",  // message
        function () { },         // callback
        'Contact Us',            // title
        'Done'                  // buttonName
    );
}
