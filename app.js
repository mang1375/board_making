const fs = require('fs'); // 폴더생성
const express = require('express');
const bodyParser = require('body-parser'); //post 방식으로 넘어온 데이터 파싱
const mysql = require('mysql'); // mysql db 사용
const multer = require('multer');

const app = express();
app.locals.pretty = true;
app.use(express.static('public'));
app.use('/board', express.static('uploads'));
app.use(bodyParser.urlencoded({ extended: false })) // parse form
app.set('views', './views')
app.set('view engine', 'ejs');

////파일업로드////
//const upload = multer({ dest: 'uploads/' });
let upload_folder;
const uploadformat = require('./uploadformat');
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        upload_folder = uploadformat.dateFormat();
        let real_folder = 'uploads/' + upload_folder;
        fs.access(real_folder, fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK, (err) => {
            if (err) { //폴더가 없으면 만들어서 넣어라
                if (err.code == 'ENOENT') { // 폴더가 없을 때 에러코드
                    fs.mkdir(real_folder, (err) => {
                        throw err;
                    });
                }
                cb(null, real_folder);
            } else { //있으면 그냥 넣어라
                cb(null, real_folder);
            }
        }); //파일시스템에 파일이 존재하는지 확인
        //R_OK는 읽기전용인지
        cb(null, real_folder)
    },
    filename: function(req, file, cb) {
        let upload_date = uploadformat.timeFormat();
        let oname = file.originalname; //sj.png
        let idx = oname.lastIndexOf('.');
        cb(null, oname.substring(0, idx) + upload_date + oname.substring(idx))
    }
})

const upload = multer({ storage: storage })

const connection = mysql.createConnection({
    host: '183.101.196.130',
    user: 'kitri',
    password: 'kitri',
    database: 'nodejs',
    port: 3306
});

connection.connect((err) => {
    if (err) {
        console.log(err);
        throw err;
    }
    console.log('connection success : ' + connection.threadId);
});

const port = 7777;
app.listen(port, () => {
    console.log('7777 open success!');
});

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/board', (req, res) => {
    let board_list = `select num, name, subject, contents, hit,
			case 
				when date_format(now(), '%Y%m%d') = date_format(regdate, '%Y%m%d')
				then date_format(regdate, '%H:%i:%s')
				else date_format(regdate, '%y.%m.%d')
			end regdate
			from board
			order by num desc;`;
    //connection.connect();
    connection.query(board_list, (err, results, fields) => {
        if (err) {
            console.log(err);
            res.status(500).send('Internal Server Error!');
        }
        console.log('DB connection success!!');
        //console.log('>>>>', results);
        //console.log('::::', fields);
        res.render('board/list', { articles: results });
        //connection.release();
        //connection.end();
    });
});

app.get('/board/write', (req, res) => {
    res.render('board/write');
});

app.post('/board/write', upload.array('picture', 2), (req, res) => {
    let values = [req.body.name, req.body.subject, req.body.contents];
    let board_insert = `
		insert into board (name, subject, contents)
		values (?, ?, ?)
	`;
    let fileinfo_insert = `
		insert into fileinfo (num, savefolder, originalname, savename)
		values ?
	`;
    console.log(values);
    console.log('files:::' + req.files);

    connection.beginTransaction((err) => {
        if (err) {
            throw err;
        }

        connection.query(board_insert, values, (err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send('Internal Server Error!!!');
            }


            let len = req.files.length;
            let fileinfos = [];
            let num = result.insertId;
            if (len != 0) {
                for (let i = 0; i < len; i++) {
                    let file = req.files[i];
                    fileinfos[i] = [num, upload_folder, file.originalname, file.filename];
                }
            } else {
                fileinfos[0] = [num, '', null, null];
            }

            connection.query(fileinfo_insert, [fileinfos], (err, result) => {
                if (err) {
                    connection.rollback(() => {
                        console.log(err);
                        throw err;
                    });
                }
                connection.commit((err) => {
                    if (err) {
                        connection.rollback(() => {
                            console.log(err);
                            throw err;
                        });
                    }
                    res.redirect('/board/' + num);
                });
            });
        });
    });
});

app.get('/board/:num', (req, res) => {
    let num = req.params.num;

    let board_update_hit = `
		update board
		set hit = hit + 1
		where num = ?
	`;

    let board_view = `
		select b.num, b.name, b.subject, b.contents, b.hit,
				date_format(b.regdate, '%Y-%m-%d %H:%i:%s') regdate,
				f.fid, f.savefolder, f.originalname, f.savename
		from board b, fileinfo f
		where b.num = f.num
		and b.num = ?
	`;

    connection.query(board_update_hit, [num], (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send('Internal Server Error!!!');
        }
        connection.query(board_view, [num], (err, results, fields) => {
            if (err) {
                console.log(err);
                res.status(500).send('Internal Server Error!!!');
            }
            res.render('board/view', { article: results })
        });
    });
});

app.get('/board/:num/delete', (req, res) => {
    let num = req.params.num;

    let fileinfo_delete = `
		delete from fileinfo
		where num = ?
	`;

    let board_delete = `
		delete from board
		where num = ?
	`;

    let select_filename = `
		select savename, savefolder from fileinfo
		where num = ?
	`;

    connection.beginTransaction((err) => {
        if (err) throw err;

        connection.query(select_filename, [num], (err, results, fields) => {
            if (err) {
                console.log(err);
                res.status(500).send('Internal Server Error!!!');
            }

            let length = results.length;
            for (var i = 0; i < length; i++) {
                console.log('지울 파일 이름 >>>' + results[i].savename);
                fs.unlink('uploads/' + results[i].savefolder + '/' + results[i].savename, () => {
                    if (err) throw err;
                    console.log("file deleted!");
                });
            }
            connection.query(fileinfo_delete, [num], (err, results, fields) => {
                if (err) {
                    console.log(err);
                    res.status(500).send('Internal Server Error!!!');
                }
                connection.query(board_delete, [num], (err, results, fields) => {
                    if (err) {
                        console.log(err);
                        res.status(500).send('Internal Server Error!!!');
                    }
                    connection.commit((err) => {
                        if (err) {
                            console.log(err);
                            res.status(500).send('Internal Server Error!!!');
                        }
                        res.redirect('/board');
                    });
                });
            });
        });
    });
});

app.get('/modify/:num', (req, res) => {
    let num = req.params.num;
    let ex_contents = `
		select num, name, subject, contents
		from board
		where num = ?;
	`;

    connection.query(ex_contents, [num], (err, results, fields) => {
        if (err) {
            console.log(err);
            res.status(500).send('Internal Server Error!');
        }
        res.render('board/modify', { article: results[0] });
    });
});

app.post('/modify/:num', (req, res) => {
    let values = [req.body.name, req.body.subject, req.body.contents, req.params.num];
    let board_update = `
		update board
		set name = ?, subject = ?, contents = ?
		where num = ?`;

    connection.query(board_update, values, (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send('Internal Server Error!');
        }
        //res.render('board/write');
        res.redirect('/board/' + req.params.num);
    });
});