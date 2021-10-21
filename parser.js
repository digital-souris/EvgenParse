const axios = require('axios')
const cheerio = require('cheerio')
const converter = require('json-2-csv')
const fs = require('fs')

module.exports = {

    async startParse(update) {
        this.updater = update
        this.options = {}
        this.page = 1
        this.data = []
        this.counter = 0
        this.maxCount = 100
        if (!this.updater) {
            this.createHeaders()
        }
        await this.loadPages(this.page)
        converter.json2csv(this.data, this.options, (err, csv) => {
            if (err) {
                throw err;
            }
            fs.writeFileSync('data.csv', csv);
        })
    },
    createHeaders() {
        /*const headers = {
            nameOrg: 'Наименование организатора',
            email: 'E-mail',
            phone: 'Телефон',
            innOrg: 'ИНН Организатора',
            fioUp: 'ФИО управляющего',
            innUp: 'ИНН управляющего',
            sro: 'СРО',
            category1: 'Категория 1',
            category2: 'Категория 2',
            region: 'Регион',
            price: 'Цена',
            name: 'Наименование имущества',
            link: 'Ссылка'
        }*/
        const headers = [
            'Наименование_организатора',
            'E-mail',
            'Телефон',
            'Начальная_цена',
            'Текущая_цена',
            'ИНН_Организатора',
            'ФИО_управляющего',
            'ИНН_управляющего',
            'СРО',
            'Категория_1',
            'Категория_2',
            'Регион',
            'Цена',
            'Наименование_имущества',
            'Ссылка'
        ]
        this.options = {fields: headers}

    },
    async loadPages() {
        try {
            const link = `https://bankrotbaza.ru/bankrot-torgi?source=1&page=${this.page}`
            const resp = await axios.get(link)
            if (resp.status === 200) {
                const $ = cheerio.load(resp.data)
                if (!$('.fa-search-dollar').length) {
                    const items = $('.kt-portlet__head-title.pt-1.mb-0')
                    for (let i = 0; i < items.length; i++) {
                        const item = items.eq(i)
                        const link = item.find('.link-hidden').attr('href')
                        if(link !== '#') {
                            await this.loadPage(link)
                        }
                    }
                    this.page = this.page + 1
                    if (this.counter >= this.maxCount) {
                        return false
                    }
                    else {
                        await this.loadPages()
                    }
                }
                else {
                    console.log('end')
                }
            }
        }
        catch (e) {
            console.log(e)
        }
    },
    async loadPage(link) {
        try {
            console.log(`Парсинг страницы ${link}`)
            const resp = await axios.get(link)
            if (resp.status === 200) {
                const $ = cheerio.load(resp.data)
                let data = {
                    'Наименование_организатора':'',
                    'E-mail':'',
                    'Телефон':'',
                    'Начальная_цена':'',
                    'Текущая_цена':'',
                    'ИНН_Организатора':'',
                    'ФИО_управляющего':'',
                    'ИНН_управляющего':'',
                    'СРО':'',
                    'Категория_1':'',
                    'Категория_2':'',
                    'Регион':'',
                    'Наименование_имущества':'',
                    'Ссылка': ''
                }
                data['Ссылка'] = link
                data['Регион'] = $('.kt-portlet__content .kt-font-google').parent().find('a').text()
                data['Наименование_имущества'] = $('span[itemprop=description]').text()
                const lotBan = $('#lot-organizator').parent().find('.kt-font-md')
                for (let i = 0;  i < lotBan.length; i++) {
                    const text = lotBan.eq(i).text()
                    if (text === 'Наименование / ФИО') {
                        data['Наименование_организатора'] = lotBan.eq(i).parent().find('.h5').text() || ''
                    }
                    else if(text === 'E-mail') {
                        data['E-mail'] = lotBan.eq(i).parent().find('.h5').text() || ''
                    }
                    else if(text === 'Контактный телефон') {
                        data['Телефон'] = lotBan.eq(i).parent().find('.h5').text() || ''
                    }
                    else if(text === 'ИНН') {
                        data['ИНН_Организатора'] = lotBan.eq(i).parent().find('.h5').text() || ''
                    }
                }
                const lotArb = $('#lot-arbitr').parent().find('.kt-font-md')
                for (let i = 0;  i < lotArb.length; i++) {
                    const text = lotArb.eq(i).text()
                    if (text === 'ФИО') {
                        data['ФИО_управляющего'] = lotArb.eq(i).parent().find('.h5').text() || ''
                    }
                    else if(text === 'СРО') {
                        data['СРО'] = lotArb.eq(i).parent().find('.h5').text() || ''
                    }
                    else if(text === 'ИНН') {
                        data['ИНН_управляющего'] = lotArb.eq(i).parent().find('.h5').text() || ''
                    }
                }
                const prices = $('div[itemprop=offers]').find('.col-6')
                for (let i = 0; i < prices.length; i++) {
                    const price = prices.eq(i)
                    if (price.find('.kt-font-md').text().indexOf('Текущая') !== -1) {
                        data['Текущая_цена'] = price.find('.h5').text().replace(',', '.').replace(/ /g, '').replace(/\n/g,'')
                    }
                    else if(price.find('.kt-font-md').text().indexOf('Начальная') !== -1 || price.find('.kt-font-md').text().indexOf('Стартовая') !== -1) {
                        data['Начальная_цена'] = price.find('.h5 span[itemprop=price]').text().replace(/\n/g,'')
                    }
                }

                const categories = $('.kt-portlet .kt-portlet__content')
                for (let i = 0; i<categories.length;i++) {
                    if (categories.eq(i).find('h4').text() === 'Категории') {
                        const cat = categories.eq(i).find('.kt-badge.kt-badge--lg')
                        data['Категория_1'] = categories.eq(i).find('.kt-badge.kt-badge--lg').eq(0).text()
                        if (cat.length > 1) {
                            data['Категория_2'] = categories.eq(i).find('.kt-badge.kt-badge--lg').eq(1).text()
                        }
                    }
                }
                this.data.push(data)
                this.counter++
            }
        }
        catch (e) {
            console.log(e)
        }
    },

}