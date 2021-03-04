const {dirname} = require("path");
const fs = require("fs");

const generateIdentifier = function()
{
	let identifier = "";
	for (let i = 0; i <= 8; ++i) identifier += String.fromCharCode(Math.round((Math.random() * (90 - 65)) + 65));
	return identifier;
};

const replaceIdentifier = function(BODY,OLD,NEW)
{
	const regex = new RegExp(`[^.>]\\b${OLD}\\b`);
	let body = BODY;
	while (true)
	{
		const matchs = regex.exec(body);
		if (matchs === null) break;
		body = body.slice(0,matchs.index + 1) + body.slice(matchs.index + 1).replace(OLD,NEW);
		regex.lastIndex = 0;
	};
	return body;
};

const localRegex = /#local (\w+(<[\w,*]+>)?\**) (\w+)( = .+?)?;/

const processLocals = function(BODY)
{
	let body = BODY;
	while (true)
	{
		const matchs = localRegex.exec(body);
		if (matchs === null) break;
		const identifier = generateIdentifier();
		body = replaceIdentifier(body.replace(matchs[0],matchs[0].replace("#local","/*local*/").replace(new RegExp(`\\b${matchs[3]}\\b`),identifier)),matchs[3],identifier);
		localRegex.lastIndex = 0;
	};
	return body;
};

const processParameters = function(PARAMETERS,BODY)
{
	let parameters = PARAMETERS;
	let body = BODY;
	if (PARAMETERS !== undefined)
	{
		const splittedParameters = PARAMETERS.split(",");
		for (let oldParameter of splittedParameters)
		{
			if (oldParameter.charAt(0) === "#")
			{
				const newParameter = oldParameter.slice(1);
				parameters = parameters.replace(oldParameter,newParameter);
				body = body.split(new RegExp(`\\b${newParameter}\\b`)).join(`(${newParameter})`);
			};
		};
	};
	return {parameters,body};
};

const macroRegex = /^#macro (\w+)\(([#\w,]+)?\)\n{\n([^]+?)\n};$/m

const processMacros = function(CODE)
{
	let code = CODE;
	while (true)
	{
		const matchs = macroRegex.exec(code);
		if (matchs === null) break;
		const {parameters,body} = processParameters(matchs[2],matchs[3]);
		code = code.replace(matchs[0],`/*macro*/ #define ${matchs[1]}(${parameters})\\\n{\\\n${processLocals(body).split("\n").join("\\\n")}\\\n}`);
		macroRegex.lastIndex = 0;
	};
	return code;
};

module.exports = function(TASK,OPTIONS)
{
	if (bolt.isNotObject(OPTIONS)) bolt.throwError(`c-preprocess: Bad formatted task "${TASK}"`);
	if (!("input" in OPTIONS)) bolt.throwError(`c-preprocess: "input" not defined in task "${TASK}"`);
	if (!("output" in OPTIONS)) bolt.throwError(`c-preprocess: "output" not defined in task "${TASK}"`);
	if (bolt.isNotString(OPTIONS.input)) bolt.throwError(`c-preprocess: Bad formatted "input" "${OPTIONS.input}" in task "${TASK}"`);
	if (bolt.isNotString(OPTIONS.output)) bolt.throwError(`c-preprocess: Bad formatted "output" "${OPTIONS.output}" in task "${TASK}"`);
	if (bolt.isNotPath(OPTIONS.input) || bolt.isNotFile(OPTIONS.input)) bolt.throwError(`c-preprocess: File "${OPTIONS.input}" not found`);
	if ((OPTIONS.output.charAt(OPTIONS.output.length - 1) === "/") || (bolt.isPath(OPTIONS.output) && bolt.isNotFile(OPTIONS.output))) bolt.throwError(`c-preprocess: Invalid "output" "${OPTIONS.output}" in task "${TASK}"`);

	const directory = dirname(OPTIONS.output);
	if (bolt.isNotPath(directory)) fs.mkdirSync(directory,{recursive: true});
	else if (bolt.isNotDirectory(directory)) bolt.throwError(`c-preprocess: Invalid "output" "${OPTIONS.output}" in task "${TASK}"`);

	fs.writeFileSync(OPTIONS.output,processMacros(fs.readFileSync(OPTIONS.input,"utf8")));
};
