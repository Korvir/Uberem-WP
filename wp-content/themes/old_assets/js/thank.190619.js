document.addEventListener('wpcf7mailsent', function (event) {
    try {

        var inputs = event.detail.inputs;

        //console.log(inputs);

        var date = new Date();
        date.setTime(date.getTime() + (5 * 60 * 1000));
        var expires = "; expires=" + date.toGMTString();
        document.cookie = "contactFormId=" + event.detail.contactFormId + expires + "; path=/";
        var redirectUrl = null;
        for (var i = 0; i < inputs.length; i++) {
            switch (inputs[i].name) {
                case 'your-name':
                    document.cookie = "userName=" + inputs[i].value + expires + "; path=/";
                    break;
                case 'address':
                    document.cookie = "address=" + inputs[i].value + expires + "; path=/";
                    break;
                case 'your-date':
                    document.cookie = "your-date=" + inputs[i].value + expires + "; path=/";
                    break;
                case 'phone':
                    document.cookie = "phone=" + inputs[i].value + expires + "; path=/";
                    break;
                case 'redirect_to_page':
                    redirectUrl = inputs[i].value;
                    break;
            }
        }

        document.cookie = "id_form=" + event.detail.contactFormId + expires + "; path=/";

        if(redirectUrl) {
            setTimeout(function () {
                window.location.href = redirectUrl;
            }, 0);
        }

    } catch (e) {
        console.error(e);
    }
}, false);
