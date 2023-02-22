let curIndex;
let parsedObj;

let prjFile;

//如果当前值和byte值不同会抛出异常
//为了确认工程文件字符串中关键处要符合json的格式
function expect(byte)
{
  if (prjFile[curIndex] == byte)
  {
    return true;
  }
  else
  {
    throw "not expect byte";
  }
}

//从当前位置跳过空白字符，如空格号和换符
function jmpBlank()
{
  while(prjFile[curIndex] == ' ' || prjFile[curIndex] == '\n')
  {
    curIndex++;
  }
}

function eatByte()
{
  if (curIndex < prjFile.length - 1)
  {
    curIndex++;
  }
}

module.exports.jsonParse = function jsonParse(prjFile_)
{
  prjFile = prjFile_;
  curIndex = 0;
  parsedObj = {};

  try {
    jmpBlank();//跳过开头可能有的空字符

    if(expect('{'))
    {
      eatByte();//将字符吃掉，即处理掉
      return parseObj(parsedObj);
    }
  } catch (error) {
    console.log("parseerror", error);
  }
  
  return null;
}

//解析对象的函数
function parseObj(parsedObj)
{
  jmpBlank();//跳过开头可能有的空字符

  if(expect('"'))
  {
    eatByte();//将字符吃掉，即处理掉

    let key = parseKey();

    jmpBlank();//跳过开头可能有的空字符
    expect(':');//key与value之间肯定是:号分隔，如果不是，直接报错
    jmpBlank();//跳过开头可能有的空字符

    eatByte();//将字符吃掉，即处理掉

    let value = parseValue();

    newObj(parsedObj, key, value);//创建新对象

    jmpBlank();

    //如果下一个字符为',',则递归调用，解析下一个对象
    if (prjFile[curIndex] == ',')
    {
      eatByte();//将字符吃掉，即处理掉

      return parseObj(parsedObj);//继续解析下一条数据
    }
    else if (prjFile[curIndex] == '}')//结束对象的解析
    {
      eatByte();//将字符吃掉，即处理掉

      return parsedObj;
    }
  }

  return null;
}

//创建新对象
function newObj(parsedObj, key, value)
{
  parsedObj[key] = value;
}

//解析Key
//读到下一个"号处
function parseKey()
{
  let key = null;
  let start = curIndex;
  let end;

  while (prjFile[curIndex] != '"') 
  {
    curIndex++;
  }

  end = curIndex;
  length = end - start;

  key = prjFile.substr(start, length);

  eatByte();//将"字符吃掉，即处理掉

  return key;
}

//解析值
//值有三种格式，数字，字符串，对象，分别处理
function parseValue()
{
  if (prjFile[curIndex] >= '0' && prjFile[curIndex] <= '9')
  {
    //是数字，直接解析后返回数字
    return parseNumber();
  }
  else if (prjFile[curIndex] == '"')
  {
    //是字符串，直接调用parseKey，因为key和字符串是一样的，key也是字符串
    eatByte();//将"字符吃掉，即处理掉

    return parseKey();
  }
  else if (prjFile[curIndex] == '[')
  {
    //是数组,调用
    eatByte();//将[字符吃掉，即处理掉

    let parsedArray = [];

    return parseArray(parsedArray);
  }

  throw 'undefined value type';
}

//解析数字
//暂时只支持整数
function parseNumber()
{
  let key = null;
  let start = curIndex;
  let end;

  while (prjFile[curIndex] >= '0' && prjFile[curIndex] <= '9') 
  {
    curIndex++;
  }

  end = curIndex;
  length = end - start;

  num_str = prjFile.substr(start, length);

  return parseInt(num_str);
}

//解析数组
//数组由两种格式，1是对象，2是数字
function parseArray(parsedArray)
{
  jmpBlank();

  if (prjFile[curIndex] == '{')
  {
    //如果是对象
    eatByte();//将{'字符吃掉，即处理掉

    let parsedObj = {};

    parsedArray.push(parseObj(parsedObj));//直接调用解析obj处理
  }
  else if (prjFile[curIndex] >= '0' && prjFile[curIndex] <= '9')
  {
    //如果是数字
    parsedArray.push(parseNumber());
  }

  jmpBlank();

  //如果下一个字符为',',则递归调用，解析下一个数组对象
  if (prjFile[curIndex] == ',')
  {
    eatByte();//将,字符吃掉，即处理掉

    return parseArray(parsedArray);
  }
  else if (prjFile[curIndex] == ']')//数组解析结束
  {
    eatByte();//将字符吃掉，即处理掉

    return parsedArray;
  }

  throw 'undefined array type';
}