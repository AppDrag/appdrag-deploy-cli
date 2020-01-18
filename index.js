#!/usr/bin/env node
const CryptoJS = require('crypto-js');
const cli = require('./cli');
const fs = require('fs');
const clear = require('clear');
const chalk = require('chalk');
const figlet = require('figlet');
const Configstore = require('configstore');
const packageJson = require('./package.json');
const config = new Configstore(packageJson.name);
const LZString = require('lz-string');

const funcs = {
    login : async () => {
        clear();
        console.log(
            chalk.magenta(
            figlet.textSync('AppDrag', { horizontalLayout: 'fitted' })
            )
        );
        let inputs = await cli.LoginPrompt();
        let toHash = 12 + inputs.password + "APPALLIN";
        let hashPassword = CryptoJS.SHA512(toHash).toString();
        let data = {
            'command' : 'Login',
            'email' : inputs.email,
            'password' : hashPassword
        }
        //console.log(data);
        let data_cleaned = cli.DataToFormURL(data);
        //console.log(data)
        let response_login = await cli.CallAPI(data_cleaned);
        if (!('status' in response_login)) {
            console.log(chalk.redBright('Incorrect email and/or password'));
            return;
        }
        console.log(chalk.greenBright('A verification code has been sent to your email'));
        inputs = await cli.CodePrompt();
        data.verificationCode = inputs.code;
        data_cleaned = cli.DataToFormURL(data);
        let response_code = await cli.CallAPI(data_cleaned);
        if (!('Table' in response_code)) {
            console.log(chalk.redBright('Incorrect code'));
        }
        let user_data = {
            token : response_code.Table[0].token,
            firstName : response_code.Table[0].firstName,
            lastName : response_code.Table[0].lastName,
            email : response_code.Table[0].email,
            Id : response_code.Table[0].Id,
            refreshToken : response_code.Table[0].refreshToken,
        }
        config.set(user_data);
        return;
    },
    push : async (args) => {
        if (args.length < 2) {
            cli.displayHelp();
            return;
        }
        let zip = await cli.zipFolder(args[1]);
        if (zip === -1) {
            console.log(chalk.red('Incorrect path specified.'));
            return;
        }
        console.log(chalk.green(`${zip}.zip Successfully written !`))
        let inputs = await cli.PushPrompt();
        let file_content = fs.readFileSync(`./${zip}.zip`,'binary');
        /* TODO: Implement destination path, unused at the moment */
        if (args.length === 2) {
            var destpath = '/';
        } else {
            var destpath = args[2];
        }
        let data = {
            command : 'SaveFileAdvanced',
            token : config.get('token'),
            appID : inputs.appID,
            filekey : `${zip}.zip`,
            isGZIP : 0,
        };
        let data_cleaned = cli.DataToFormURL(data);
        data_cleaned += "&content="+file_content;
        //console.log(file_content);
        let response_code = await cli.CallAPI(data_cleaned);
        if (response_code.status == 'KO') {
            /* Refresh Token */
            let rfrsh_data = {command:'RefreshToken', refreshToken:config.get('refreshToken')}
            let rfrsh_clean = cli.DataToFormURL(rfrsh_data);
            let response_rfrsh = await cli.CallAPI(rfrsh_clean);
            config.set('token', response_rfrsh.token);
            data.token = config.get('token');
            data_cleaned = cli.DataToFormURL(data);
            response_code = await cli.CallAPI(data_cleaned);
        }
                    /* Payload creation */
        let payload = cli.PayLoadBuilder(zip,inputs.appID);
        let sign_clean = cli.DataToFormURL({command:'GetPreSignedUrl',appID:inputs.appID,token:config.get('token')});
        let response_sign = await cli.CallAPIGET(sign_clean, JSON.stringify(payload));
        //console.log(response_sign);
        let data_to_form = {
            key : `${inputs.appID}/${zip}.zip`,
            'Content-Type' : 'application/x-zip-compressed',
            success_action_status : 200,
            acl : 'public-read',
            'x-amz-meta-qqfilename' : `${zip}.zip`,
            AWSAccessKeyId : response_sign.AWSAccessKeyId,
            policy : response_sign.policy,
            signature : response_sign.signature,
            file: file_content,
        }
        console.log(data_to_form)
        let formdata_sign = cli.DataToFormData(data_to_form);
        console.log(zip);
        let fdata = await cli.CallAPI(formdata_sign, 'https://s3-eu-west-1.amazonaws.com/dev.appdrag.com')
        console.log(fdata);
    },
}

const main = async () => {
    var isLogged = await cli.isAuth(config);
    var args = process.argv.slice(2);
    /* TODO: Help display */
    if (args.length == 0) {
        cli.displayHelp();
    }
    if (!isLogged) await funcs['login'](); // If not logged, force-login
    if (args[0] in funcs) { //Is the first arg a valid function 
        await funcs[args[0]](args);
    } else { //If function doesn't exist display help
        cli.displayHelp();
    }
    return;
}
main();